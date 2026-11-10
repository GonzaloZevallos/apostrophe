"""Expenses over a business that stores hundredths (docs/adr/0058).

Seams: the expenses repository and ledger over a scale-2 session, and the expenses HTTP
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
from app.expenses.adapters.expenses_ledger import SqlExpensesLedger
from app.expenses.adapters.sql_expenses import SqlExpenses
from app.expenses.adapters.tables import ExpenseRow
from app.expenses.domain.month import Month
from app.shared.money import Money, MoneyNotRepresentable
from tests.conftest import NOW
from tests.money_wire import assert_money_is_int

TODAY = "2026-10-02"


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


def _category_id(client: TestClient) -> int:
    return int(client.get("/expense-categories").json()[0]["id"])


def _body(client: TestClient, amount: Any) -> dict[str, Any]:
    return {
        "spent_on": TODAY,
        "category_id": _category_id(client),
        "amount": amount,
        "detail": "fletes",
    }


def test_an_expense_is_stored_at_the_business_scale_and_read_back_in_whole_units(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    created = client.post("/expenses", json=_body(client, 1_500))
    edited = client.put(f"/expenses/{created.json()['id']}", json=_body(client, 2_500))

    assert (created.json()["amount"], edited.json()["amount"]) == (1_500, 2_500)
    assert _raw(engine, "SELECT amount FROM expense") == [(_stored(2_500, money_scale),)]
    with Session(engine) as session:
        found = SqlExpenses(session, _business_id(engine)).by_id(created.json()["id"])
    assert found is not None and found.amount == 2_500


def test_the_monthly_view_and_the_ledger_sum_the_same_at_both_scales(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    client.post("/expenses", json=_body(client, 1_500))
    client.post("/expenses", json=_body(client, 2_500))

    view = client.get("/expenses", params={"month": "2026-10"}).json()

    assert view["total"] == 4_000
    assert_money_is_int(view, "total", "categories[].subtotal", "categories[].expenses[].amount")
    with Session(engine) as session:
        business_id = _business_id(engine)
        in_month = SqlExpenses(session, business_id).in_month(Month.of("2026-10"))
        records = SqlExpensesLedger(session, business_id).all()
    assert sorted(e.expense.amount for e in in_month) == [1_500, 2_500]
    assert sorted(record.amount for record in records) == [1_500, 2_500]


@pytest.mark.parametrize("verb", ["post", "put"])
def test_an_amount_with_a_decimal_is_refused_and_nothing_is_saved(
    client: TestClient, engine: Engine, verb: str, money_scale: int
) -> None:
    existing = client.post("/expenses", json=_body(client, 1_500)).json()
    url = "/expenses" if verb == "post" else f"/expenses/{existing['id']}"

    refused = client.request(verb, url, json=_body(client, 10.5))

    assert refused.status_code == 422
    assert refused.json()["code"] == "money.too_many_decimals"
    assert "10.5" not in refused.text
    assert _raw(engine, "SELECT amount FROM expense") == [(_stored(1_500, money_scale),)]


def test_a_stored_amount_with_cents_is_an_integrity_failure_not_a_rounded_figure(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    if money_scale != 2:
        pytest.skip("only a business that stores hundredths can hold cents")
    business_id = _business_id(engine)
    with Session(engine) as session:
        session.add(
            ExpenseRow(
                business_id=business_id,
                category_id=_category_id(client),
                spent_on=NOW.date(),
                amount=money_stored_value(session, business_id, Money(150)),
                detail="fletes",
                recorded_at=NOW,
            )
        )
        session.commit()

    with Session(engine) as session, pytest.raises(MoneyNotRepresentable) as failed:
        SqlExpensesLedger(session, business_id).all()
    assert "1.5" not in str(failed.value)
