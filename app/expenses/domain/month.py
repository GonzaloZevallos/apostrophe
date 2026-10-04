"""A calendar month in Argentina time (docs/product/expenses.md: Monthly view).

`Month` itself now lives in `app/shared/calendar.py` (ADR-0013), shared with Análisis
and Results: this module keeps expenses' own contract unchanged by translating its
plain `ValueError` into `InvalidMonth` (`expense.month_invalid`), the one error code
the rest of expenses already depends on.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from app.expenses.domain.category import ExpenseRuleBroken
from app.shared.calendar import Month as _Month


class InvalidMonth(ExpenseRuleBroken):
    code: ClassVar[str] = "expense.month_invalid"

    def __init__(self) -> None:
        super().__init__("a month is written YYYY-MM")


class Month(_Month):
    @classmethod
    def of(cls, raw: str) -> Month:
        try:
            parsed = _Month.of(raw)
        except ValueError:
            raise InvalidMonth() from None
        return cls(parsed.year, parsed.month)

    @classmethod
    def containing(cls, day: date) -> Month:
        parsed = _Month.containing(day)
        return cls(parsed.year, parsed.month)
