"""A period's total (docs/product/results.md): the pure sum behind results'
`PeriodExpenses` port (`app/results/application/ports.py`). No SQL aggregate sums
expenses anywhere (plan invariant); this sums what `SqlExpenses.between` already
loaded, the same way `MonthlyExpenses.of` sums a month's categorized expenses.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.expenses.domain.expense import Expense


def total_of(expenses: Sequence[Expense]) -> int:
    return sum(expense.amount for expense in expenses)
