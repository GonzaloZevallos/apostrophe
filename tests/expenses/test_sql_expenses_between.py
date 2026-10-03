"""`SqlExpenses.between` (CODING_STANDARDS section 5: repository seam test over a real
database). This is the one load `SqlPeriodExpenses.totals` sums per period (plan: "one
load over min..max, then a sum per period"), so its bounds and isolation are tested
here directly, not only through that sum.
"""

from datetime import date
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expenses import SqlExpenses

# `client` opens the first business on a fresh engine, `other_client` the second.
BUSINESS_ID = 1


def _category_id(client: TestClient, name: str = "Otros") -> int:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == name)
    return int(category["id"])


def _record(client: TestClient, spent_on: str, **overrides: Any) -> None:
    body: dict[str, Any] = {
        "spent_on": spent_on,
        "category_id": _category_id(client),
        "amount": 1_000,
        "detail": "fletes",
    }
    body.update(overrides)
    response = client.post("/expenses", json=body)
    assert response.status_code == 201, response.text


def test_between_includes_both_bounds_and_excludes_just_outside_them(
    client: TestClient, engine: Engine
) -> None:
    _record(client, "2026-09-30")
    _record(client, "2026-10-02")
    _record(client, "2026-09-29")  # one day before the start: excluded

    with Session(engine) as session:
        expenses = SqlExpenses(session, BUSINESS_ID).between(date(2026, 9, 30), date(2026, 10, 2))

    assert sorted(expense.spent_on for expense in expenses) == [
        date(2026, 9, 30),
        date(2026, 10, 2),
    ]


def test_between_spans_a_month_boundary(client: TestClient, engine: Engine) -> None:
    _record(client, "2026-09-28")
    _record(client, "2026-10-02")

    with Session(engine) as session:
        expenses = SqlExpenses(session, BUSINESS_ID).between(date(2026, 9, 28), date(2026, 10, 2))

    assert len(expenses) == 2


def test_between_excludes_another_businesss_expenses(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _record(other_client, "2026-10-01")

    with Session(engine) as session:
        expenses = SqlExpenses(session, BUSINESS_ID).between(date(2026, 1, 1), date(2026, 12, 31))

    assert expenses == []
