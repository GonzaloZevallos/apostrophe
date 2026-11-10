"""Payments over a business that stores hundredths (docs/adr/0058).

Seams: the payments repositories and ledgers over a scale-2 session, and the payments HTTP
routes through `TestClient`. The suite's `SCALES` stays `(0,)` until the flip, so scale 2 is
opened here through the app's own opening wiring.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import money_stored_value
from app.payments.adapters.payments_ledger import SqlPaymentsLedger
from app.payments.adapters.sql_ledgers import SqlLedgers
from app.payments.adapters.sql_payments import SqlPayments
from app.payments.adapters.tables import PaymentRow
from app.payments.domain.payment import PaymentAboveBalance
from app.shared.money import Money, MoneyNotRepresentable
from tests.conftest import NOW
from tests.money_wire import assert_money_is_int


@pytest.fixture(params=(0, 2))
def money_scale(request: pytest.FixtureRequest) -> int:
    """This module opens its businesses at both scales; the `app` fixture hands the scale
    to the opening wiring."""
    scale: int = request.param
    return scale


def _stored(units: int, scale: int) -> int:
    factor: int = 10**scale
    return units * factor


def _raw(engine: Engine, sql: str) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        return [tuple(row) for row in connection.execute(text(sql)).all()]


def _business_id(engine: Engine) -> int:
    return int(_raw(engine, "SELECT id FROM business")[0][0])


def _owing_customer(client: TestClient) -> int:
    product = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 1_000},
    )
    customer = client.post("/customers", json={"name": "Juana", "phone": "11 1000-0000"}).json()
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": {"kind": "owing"},
            "date": "2026-09-14",
            "shipping_charged": 500,
            "lines": [{"product_id": product["id"], "quantity": "10"}],
        },
    )
    assert sale.status_code == 201, sale.text
    return int(customer["id"])


def _pay(client: TestClient, customer_id: int, amount: Any) -> Any:
    return client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": amount, "payment_method_id": 1},
    )


def test_a_later_payment_is_stored_at_the_business_scale_and_the_account_reads_it_back(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    customer_id = _owing_customer(client)

    recorded = _pay(client, customer_id, 4_000)

    assert recorded.status_code == 201, recorded.text
    assert recorded.json()["after"]["balance"] == 6_500
    assert _raw(engine, "SELECT amount FROM payment") == [(_stored(4_000, money_scale),)]
    account = client.get(f"/customers/{customer_id}/account").json()
    assert account["balance"] == 6_500
    assert_money_is_int(account, "balance", "rows[].running_balance")
    debtors = client.get("/payments/debtors").json()
    assert (debtors["total_owed"], debtors["debtors"][0]["balance"]) == (6_500, 6_500)
    assert_money_is_int(debtors, "total_owed", "debtors[].balance")


def test_the_preview_is_the_same_at_both_scales(client: TestClient, money_scale: int) -> None:
    customer_id = _owing_customer(client)

    preview = client.post(
        f"/customers/{customer_id}/payments/preview",
        json={"paid_on": "2026-09-20", "amount": 4_000},
    )

    assert preview.status_code == 200, preview.text
    assert preview.json()["after"]["balance"] == 6_500
    assert_money_is_int(preview.json(), "applied_to[].amount", "after.balance")


def test_the_balance_guard_compares_in_hundredths_at_both_scales(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    customer_id = _owing_customer(client)
    business_id = _business_id(engine)

    with Session(engine) as session:
        payments = SqlPayments(session, business_id)
        with pytest.raises(PaymentAboveBalance):
            payments.insert_later(customer_id, NOW.date(), 10_501, 1, NOW)
        payments.insert_later(customer_id, NOW.date(), 10_500, 1, NOW)
        session.commit()

    assert _raw(engine, "SELECT amount FROM payment") == [(_stored(10_500, money_scale),)]


def test_the_ledgers_and_the_payments_ledger_sum_in_whole_units(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    customer_id = _owing_customer(client)
    _pay(client, customer_id, 4_000)

    with Session(engine) as session:
        ledger = SqlLedgers(session, _business_id(engine)).for_customer(customer_id)
        records = SqlPaymentsLedger(session, _business_id(engine)).all()

    assert ledger is not None
    assert [sale.total for sale in ledger.sales] == [10_500]
    assert [payment.amount for payment in ledger.payments] == [4_000]
    assert [record.amount for record in records] == [4_000]


@pytest.mark.parametrize("route", ["preview", "payments"])
def test_an_amount_with_a_decimal_is_refused_and_nothing_is_saved(
    client: TestClient, engine: Engine, route: str
) -> None:
    customer_id = _owing_customer(client)

    refused = client.post(
        f"/customers/{customer_id}/payments" + ("/preview" if route == "preview" else ""),
        json={"paid_on": "2026-09-20", "amount": 10.5, "payment_method_id": 1},
    )

    assert refused.status_code == 422
    assert refused.json()["code"] == "money.too_many_decimals"
    assert "10.5" not in refused.text
    assert _raw(engine, "SELECT count(*) FROM payment") == [(0,)]


def test_a_whole_amount_written_with_zero_decimals_is_accepted(client: TestClient) -> None:
    customer_id = _owing_customer(client)

    assert _pay(client, customer_id, 4_000.0).status_code == 201


def test_a_stored_amount_with_cents_is_an_integrity_failure_not_a_rounded_figure(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    if money_scale != 2:
        pytest.skip("only a business that stores hundredths can hold cents")
    customer_id = _owing_customer(client)
    business_id = _business_id(engine)
    with Session(engine) as session:
        session.add(
            PaymentRow(
                business_id=business_id,
                paid_on=NOW.date(),
                amount=money_stored_value(session, business_id, Money(150)),
                payment_method_id=1,
                customer_id=customer_id,
                sale_id=None,
                recorded_at=NOW,
            )
        )
        session.commit()

    with Session(engine) as session, pytest.raises(MoneyNotRepresentable) as failed:
        SqlPaymentsLedger(session, business_id).all()
    assert "1.5" not in str(failed.value)
