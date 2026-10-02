"""An expense (CONTEXT.md: Expense): money spent on something other than flower, filed
under one expense category.

`Expense.of` is the one constructor recording and editing both go through, so the same
four rules apply either way. `recorded_at` is not one of those four fields: it is set
once, from the injected clock, when an expense is first recorded, and an edit carries it
through unchanged (the caller passes the existing value back in).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from app.expenses.domain.category import ExpenseRuleBroken

AMOUNT_MAX = 10**12
DETAIL_MAX_LENGTH = 200


class InvalidExpenseDate(ExpenseRuleBroken):
    pass


class InvalidAmount(ExpenseRuleBroken):
    pass


class InvalidDetail(ExpenseRuleBroken):
    pass


class ExpenseNotFound(LookupError):
    def __init__(self, expense_id: int) -> None:
        super().__init__(f"no expense {expense_id}")


@dataclass
class Expense:
    spent_on: date
    category_id: int
    amount: int
    detail: str
    recorded_at: datetime
    id: int | None = None

    @classmethod
    def of(
        cls,
        spent_on: date,
        category_id: int,
        amount: int,
        detail: str,
        today: date,
        recorded_at: datetime,
        id: int | None = None,
    ) -> Expense:
        if spent_on > today:
            raise InvalidExpenseDate("an expense is not dated after today")
        if amount <= 0:
            raise InvalidAmount("an amount is above zero")
        if amount > AMOUNT_MAX:
            raise InvalidAmount(f"an amount is at most {AMOUNT_MAX} pesos")
        trimmed = detail.strip()
        if not trimmed:
            raise InvalidDetail("a detail is required")
        if len(trimmed) > DETAIL_MAX_LENGTH:
            raise InvalidDetail(f"a detail has at most {DETAIL_MAX_LENGTH} characters")
        return cls(spent_on, category_id, amount, trimmed, recorded_at, id)
