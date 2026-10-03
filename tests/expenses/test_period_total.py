"""`total_of` (docs/product/results.md): the pure sum behind results' `PeriodExpenses`
port (CODING_STANDARDS section 5: domain unit test, no infrastructure). No SQL
aggregate sums expenses anywhere (plan invariant); this is the one place the sum
happens, over whatever `SqlExpenses.between` already loaded.
"""

from datetime import UTC, date, datetime

from app.expenses.domain.expense import Expense
from app.expenses.domain.period_total import total_of


def _expense(amount: int, spent_on: date = date(2026, 10, 1)) -> Expense:
    return Expense(
        spent_on=spent_on,
        category_id=1,
        amount=amount,
        detail="fletes",
        recorded_at=datetime(2026, 10, 1, tzinfo=UTC),
    )


def test_total_of_sums_every_expenses_amount() -> None:
    expenses = [_expense(1_000), _expense(2_500)]

    assert total_of(expenses) == 3_500


def test_total_of_the_empty_sequence_is_zero() -> None:
    assert total_of([]) == 0
