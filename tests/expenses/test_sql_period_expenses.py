"""`SqlPeriodExpenses.totals`: results' `PeriodExpenses` port
(`app/results/application/ports.py`), implemented from expenses' own data
(CODING_STANDARDS section 5: repository seam test over a real database). One
`SqlExpenses.between` load over the covering range, then `total_of` summed per
period — never one query per period.
"""

from datetime import date
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.sql_period_expenses import SqlPeriodExpenses
from app.results.domain.periods import Period

# `client` opens the first business on a fresh engine, `other_client` the second. The
# clock is fixed at 2026-10-02 (a Friday): today is 02/10, the week 28/09-04/10, the
# month 01/10-31/10 (tests/conftest.py).
BUSINESS_ID = 1
TODAY = Period(date(2026, 10, 2), date(2026, 10, 2))
WEEK = Period(date(2026, 9, 28), date(2026, 10, 4))
MONTH = Period(date(2026, 10, 1), date(2026, 10, 31))


def _category_id(client: TestClient, name: str = "Otros") -> int:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == name)
    return int(category["id"])


def _record(client: TestClient, spent_on: str, amount: int) -> None:
    body: dict[str, Any] = {
        "spent_on": spent_on,
        "category_id": _category_id(client),
        "amount": amount,
        "detail": "fletes",
    }
    response = client.post("/expenses", json=body)
    assert response.status_code == 201, response.text


def test_totals_sums_each_period_from_the_one_load(client: TestClient, engine: Engine) -> None:
    _record(client, "2026-10-02", 1_000)  # today, week and month
    _record(client, "2026-09-29", 500)  # week only
    _record(client, "2026-10-01", 700)  # week and month, not today
    _record(client, "2026-09-20", 300)  # before the week: no period

    with Session(engine) as session:
        totals = SqlPeriodExpenses(session, BUSINESS_ID).totals([TODAY, WEEK, MONTH])

    assert totals == {TODAY: 1_000, WEEK: 2_200, MONTH: 1_700}


def test_totals_excludes_an_expense_dated_just_after_a_narrower_periods_end(
    client: TestClient, engine: Engine
) -> None:
    """A narrow period ending before today, so an expense dated the day after its
    own end is still a valid (not-in-the-future) expense to record — unlike
    `TODAY`/`WEEK`/`MONTH` above, whose ends all sit on or after the clock's own
    today. Pins the upper bound at the `totals` seam, not only at `between`'s."""
    narrow = Period(date(2026, 9, 10), date(2026, 9, 20))
    _record(client, "2026-09-20", 1_000)  # the end bound: included
    _record(client, "2026-09-21", 500)  # one day after the end: excluded

    with Session(engine) as session:
        totals = SqlPeriodExpenses(session, BUSINESS_ID).totals([narrow])

    assert totals == {narrow: 1_000}


def test_totals_excludes_another_businesss_expenses(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _record(other_client, "2026-10-02", 9_999)

    with Session(engine) as session:
        totals = SqlPeriodExpenses(session, BUSINESS_ID).totals([TODAY, WEEK, MONTH])

    assert totals == {TODAY: 0, WEEK: 0, MONTH: 0}
