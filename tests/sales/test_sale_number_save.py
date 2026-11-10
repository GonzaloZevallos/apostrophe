"""The Sale number under a failing or a concurrent save (docs/adr/0073): a save that does
not commit takes no number, and two writers of one business never share one.

The failed-save cases run `record_sale` over a real Session on the test engine with the real
`SqlSales`; the concurrency case runs `SqlSales.add` over two sessions of a file-backed
SQLite, the second with no wait for the lock."""

from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.payments.adapters.on_the_spot import SqlOnTheSpotPayments
from app.sales.adapters.sql_sales import SqlSales
from app.sales.adapters.tables import SaleRow
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import PriceQuote, PricingRule, VarietyPricing
from app.sales.domain.sale import CustomerFact, Sale, SaleLine
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from tests.conftest import TODAY
from tests.fakes.money_format import WholeAmounts

NOW = datetime(2026, 10, 2, 12, tzinfo=UTC)
A_VARIETY_THAT_DOES_NOT_EXIST = 9_999


class _QuotesAnyVariety:
    """A price book that quotes a variety whether or not it has a row."""

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        return VarietyPricing(variety_id, PriceQuote(list_price=10_000))


class _NoCustomers:
    def get(self, customer_id: int) -> CustomerFact | None:
        return None


class _Settings:
    def current(self) -> PricingSettings:
        return PricingSettings(is_bulk_pricing=False, is_vip_customers=False)


class _CommitFails:
    """A transaction whose commit fails after the sale was added: the session is then
    closed without a commit, as the request session is on any error."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def commit(self) -> None:
        raise RuntimeError("the commit failed")

    def rollback(self) -> None:
        self._session.rollback()


def _record(session: Session, variety_id: int, commit_fails: bool) -> Sale:
    return record_sale(
        SqlSales(session, 1),
        SqlOnTheSpotPayments(session, 1),
        _QuotesAnyVariety(),
        _NoCustomers(),
        _Settings(),
        WholeAmounts(),
        _CommitFails(session) if commit_fails else session,
        sale_date=TODAY,
        today=TODAY,
        customer_id=None,
        shipping_charged=Decimal(0),
        note=None,
        lines=[LineInput(variety_id=variety_id, quantity=Quantity.of(1))],
        payment_method_id=1,
        left_owing=False,
        recorded_at=NOW,
    )


def _counter(engine: Engine) -> int:
    with Session(engine) as session:
        return session.scalars(select(BusinessRow.last_sale_number)).one()


def _real_variety(client: TestClient) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(variety["id"])


def test_a_save_refused_for_a_missing_variety_uses_no_number(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _real_variety(client)

    with Session(engine) as session, pytest.raises(ReferenceRefused):
        _record(session, A_VARIETY_THAT_DOES_NOT_EXIST, commit_fails=False)

    assert _counter(engine) == 0
    sale = client.post(
        "/sales",
        json={
            "payment": {"kind": "method", "payment_method_id": 1},
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    ).json()
    assert sale["number"] == 1
    assert _counter(engine) == 1


def test_a_save_that_fails_after_the_increment_and_is_never_committed_uses_no_number(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _real_variety(client)

    with Session(engine) as session:
        with pytest.raises(RuntimeError, match="the commit failed"):
            _record(session, variety_id, commit_fails=True)
        assert session.scalars(select(BusinessRow.last_sale_number)).one() == 1

    assert _counter(engine) == 0
    with Session(engine) as session:
        assert session.scalars(select(SaleRow.id)).all() == []
    sale = client.post(
        "/sales",
        json={
            "payment": {"kind": "method", "payment_method_id": 1},
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    ).json()
    assert sale["number"] == 1
    assert _counter(engine) == 1


def _sale() -> Sale:
    return Sale(
        date=TODAY,
        customer_id=None,
        shipping_charged=0,
        note=None,
        lines=(SaleLine(1, Quantity.of(1), PricingRule.LIST, 100, 100),),
        payment=None,
        recorded_at=NOW,
    )


def test_two_writers_of_one_business_never_share_a_number(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    first_engine = make_engine(url)
    upgrade_to_head(first_engine)
    with first_engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (1, 'N', 'en')"))
        connection.execute(
            text(
                "INSERT INTO money_format (business_id, symbol, decimals, scale)"
                " VALUES (1, '$', 0, 0)"
            )
        )
        connection.execute(
            text("INSERT INTO variety (id, business_id, name, name_key) VALUES (1, 1, 'V', 'v')")
        )
    second_engine = create_engine(url, connect_args={"timeout": 0})

    with Session(first_engine) as first, Session(second_engine) as second:
        held = SqlSales(first, 1).add(_sale())
        assert held.number == 1

        # The first writer holds the uncommitted increment: the second finds it locked.
        with pytest.raises(OperationalError):
            SqlSales(second, 1).add(_sale())
        second.rollback()
        first.commit()

        retried = SqlSales(second, 1).add(_sale())
        second.commit()

    assert retried.number == 2
    with Session(first_engine) as session:
        assert sorted(session.scalars(select(SaleRow.number)).all()) == [1, 2]
        assert session.scalars(select(BusinessRow.last_sale_number)).one() == 2
    first_engine.dispose()
    second_engine.dispose()
