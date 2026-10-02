"""A calendar month in Argentina time (docs/product/expenses.md: Monthly view).

This is the only code in the app that parses `?month=` or computes a month's
boundaries; the repository query and the front both go through it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from app.expenses.domain.category import ExpenseRuleBroken

_PATTERN = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


class InvalidMonth(ExpenseRuleBroken):
    def __init__(self) -> None:
        super().__init__("a month is written YYYY-MM")


@dataclass(frozen=True)
class Month:
    year: int
    month: int

    @classmethod
    def of(cls, raw: str) -> Month:
        """Parses `YYYY-MM` strictly: four digits, a dash, then `01`-`12`. The regex
        alone lets through years `date` cannot hold at either boundary (`0000`, or
        `9999` in December, whose next first day would be year 10000); both boundaries
        are checked here so a bad month is refused (422), never a 500."""
        match = _PATTERN.match(raw)
        if match is None:
            raise InvalidMonth()
        month = cls(int(match.group(1)), int(match.group(2)))
        try:
            _ = month.first_day
            _ = month.next_first_day
        except ValueError:
            raise InvalidMonth() from None
        return month

    @classmethod
    def containing(cls, day: date) -> Month:
        return cls(day.year, day.month)

    @property
    def first_day(self) -> date:
        return date(self.year, self.month, 1)

    @property
    def next_first_day(self) -> date:
        return date(self.year + 1, 1, 1) if self.month == 12 else date(self.year, self.month + 1, 1)

    def __str__(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"
