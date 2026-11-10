"""The rescale against a writer on another connection (docs/adr/0080, amending docs/adr/0058).

Seam: the `ApplyMoneyFormat` use case with the real adapter, and `GET /sales` and
`GET /expenses` through `TestClient` for the figures, over a file-backed SQLite database,
two engines in one thread and a short busy timeout on the test engines only. The amount
write is a real sale, recorded by `record_sale` with the real adapters: it reads the stored
prices at the old scale and writes the sale, its lines and its payment.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import ConnectionPoolEntry

from app.db import MoneyScaleChanged, make_engine
from app.money_format.adapters.reader import SqlMoneyFormat
from app.money_format.adapters.sql_money_format_writer import SqlMoneyFormatWriter
from app.money_format.domain.rescale import RescaleBusy
from app.shared.money import MoneyFormat
from app.pricing_settings.adapters.sql_pricing_settings import SqlPricingSettings
from app.sales.adapters.customer_facts import SqlCustomerFacts
from app.sales.adapters.price_book import SqlPriceBook
from app.sales.adapters.sql_sales import SqlSales
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.sale import PaymentMethod, Sale
from app.shared.quantity import Quantity
from tests.business_removal.adapters.seed import PINNED, build_app
from tests.conftest import MovableClock
from tests.money_format.rescale_world import World, apply, dump, money_format_of

SEEDED_TOTAL = Decimal(112233)


@pytest.fixture
def second(world: World) -> Iterator[Engine]:
    """A second engine on the same file, and a short busy timeout on both."""
    engine = world.engine
    other = make_engine(engine.url.render_as_string(hide_password=False))
    for each in (engine, other):
        event.listen(each, "connect", _short_timeout)
        each.dispose()
    yield other
    other.dispose()


def _short_timeout(dbapi_connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
    dbapi_connection.execute("PRAGMA busy_timeout=50")


class _SalesWriting(SqlSales):
    """The real sales adapter, with something to do just before the sale is written: after
    the sale has read its prices (and cached the factor) and before its first INSERT."""

    def __init__(self, session: Session, business_id: int, before_write: Callable[[], None]):
        super().__init__(session, business_id)
        self._before_write = before_write

    def add(self, sale: Sale) -> Sale:
        self._before_write()
        return super().add(sale)


def _nothing() -> None:
    return None


def _sell(session: Session, business_id: int, before_write: Callable[[], None] = _nothing) -> None:
    """One sale of a Rosa at its list price (4000), recorded by the use case and committed."""
    product = session.execute(
        text("SELECT id FROM variety WHERE business_id = :b AND name = 'Rosa'"),
        {"b": business_id},
    ).scalar_one()
    record_sale(
        _SalesWriting(session, business_id, before_write),
        SqlPriceBook(session, business_id),
        SqlCustomerFacts(session, business_id),
        SqlPricingSettings(session, business_id),
        SqlMoneyFormat(session, business_id),
        session,
        sale_date=PINNED.date(),
        today=PINNED.date(),
        customer_id=None,
        shipping_charged=Decimal(0),
        note=None,
        lines=[LineInput(variety_id=product, quantity=Quantity.of(Decimal(1)))],
        method=PaymentMethod.CASH,
        left_owing=False,
        recorded_at=PINNED,
    )


def _total(world: World) -> Decimal:
    """The month's expenses total the API answers for the business."""
    application, engine = build_app(world.path, MovableClock(PINNED), 0)
    try:
        with TestClient(application) as client:
            client.headers["Authorization"] = f"Bearer {world.token}"
            answered = client.get("/expenses", params={"month": "2026-10"})
    finally:
        engine.dispose()
    assert answered.status_code == 200, answered.text
    total = json.loads(answered.text, parse_float=Decimal, parse_int=Decimal)["total"]
    assert isinstance(total, Decimal)
    return total


def _sale_totals(world: World) -> list[Decimal]:
    """The total of every sale the API lists for the business, sorted."""
    application, engine = build_app(world.path, MovableClock(PINNED), 0)
    try:
        with TestClient(application) as client:
            client.headers["Authorization"] = f"Bearer {world.token}"
            answered = client.get("/sales")
    finally:
        engine.dispose()
    assert answered.status_code == 200, answered.text
    sales = json.loads(answered.text, parse_float=Decimal, parse_int=Decimal)
    return sorted(sale["total"] for sale in sales)


def _rescaling(second: Engine, business_id: int) -> Session:
    """A session on the other connection that has run the rescale and not committed."""
    session = Session(second)
    SqlMoneyFormatWriter(session).apply(business_id, MoneyFormat("$", 2))
    return session


def test_a_sale_that_read_the_old_scale_fails_loudly_and_a_retry_stores_the_right_value(
    world: World, second: Engine
) -> None:
    target = world.target
    already = _sale_totals(world)
    with Session(world.engine) as sale:
        with pytest.raises(MoneyScaleChanged):
            # The sale has read its prices at scale 0; the rescale commits; the sale writes.
            _sell(sale, target, before_write=lambda: apply(second, target, 2))
        sale.rollback()

        _sell(sale, target)

    assert money_format_of(second, target) == (2, 2)
    assert _sale_totals(world) == sorted([*already, Decimal(4000)])


def test_a_sale_against_a_rescale_holding_the_lock_fails_busy_and_a_retry_stores_at_scale_2(
    world: World, second: Engine
) -> None:
    target = world.target
    already = _sale_totals(world)
    rescale = _rescaling(second, target)
    with Session(world.engine) as sale:
        with pytest.raises(OperationalError):
            _sell(sale, target)
        sale.rollback()
        rescale.commit()

        _sell(sale, target)
    rescale.close()

    assert money_format_of(world.engine, target) == (2, 2)
    assert _sale_totals(world) == sorted([*already, Decimal(4000)])


def test_a_sale_committed_before_the_rescale_is_rescaled_with_the_rest(
    world: World, second: Engine
) -> None:
    target = world.target
    already = _sale_totals(world)
    with Session(world.engine) as sale:
        _sell(sale, target)
    expected = sorted([*already, Decimal(4000)])
    assert _sale_totals(world) == expected

    apply(second, target, 2)

    assert _sale_totals(world) == expected
    assert money_format_of(world.engine, target) == (2, 2)


def test_a_busy_database_makes_the_rescale_change_nothing(world: World, second: Engine) -> None:
    target = world.target
    before = dump(world.engine, target)
    with Session(second) as holder:
        holder.execute(
            text("UPDATE expense SET detail = detail WHERE business_id = :b"), {"b": target}
        )

        with pytest.raises(RescaleBusy) as raised:
            apply(world.engine, target, 2)

        assert str(raised.value) == "the database was busy: nothing changed, run it again"
        holder.rollback()

    assert dump(world.engine, target) == before
    assert money_format_of(world.engine, target) == (0, 0)
    assert _total(world) == SEEDED_TOTAL
