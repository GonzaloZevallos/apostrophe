"""Calendar boundaries shared by every capability that reads a period (ADR-0020).

`Month` moved here from `app/expenses/domain/month.py`, raising a plain `ValueError`
(not a capability's own error): `app.expenses.domain.month.Month` wraps it, translating
that `ValueError` into `InvalidMonth` so expenses' own contract does not change.
`Week` (Monday to Sunday) sits beside it for Análisis and Results. This is the one
place a week or month boundary is computed; no router, adapter or front module works
one out on its own (the plan's invariant).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import cache
from zoneinfo import ZoneInfo, available_timezones

_PATTERN = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def business_day(instant: datetime, zone: ZoneInfo) -> date:
    """The calendar day `instant` falls on in `zone`: the only function that turns an
    instant into a business day (docs/adr/0057). `zone` is always the zone of one
    business; there is no default."""
    return instant.astimezone(zone).date()


@cache
def _known_zone_names() -> frozenset[str]:
    return frozenset(available_timezones())


def load_zone(name: str) -> ZoneInfo | None:
    """The zone a stored name stands for, or `None` when the installed IANA data has no
    such name. Membership in `available_timezones()` decides, never a `ZoneInfo(name)`
    that raises: the constructor is not a validator (it accepts paths and, on some
    platforms, other cases of a name)."""
    return ZoneInfo(name) if name in _known_zone_names() else None


@dataclass(frozen=True, order=True)
class Month:
    year: int
    month: int

    @classmethod
    def of(cls, raw: str) -> Month:
        """Parses `YYYY-MM` strictly: four digits, a dash, then `01`-`12`. Raises a
        plain `ValueError` — the regex alone lets through years `date` cannot hold at
        either boundary (`0000`, or `9999` in December), so both boundaries are
        checked here too."""
        match = _PATTERN.match(raw)
        if match is None:
            raise ValueError("a month is written YYYY-MM")
        month = cls(int(match.group(1)), int(match.group(2)))
        try:
            _ = month.first_day
            _ = month.next_first_day
        except ValueError:
            raise ValueError("a month is written YYYY-MM") from None
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

    @property
    def last_day(self) -> date:
        return self.next_first_day - timedelta(days=1)

    @property
    def previous(self) -> Month:
        return (
            Month(self.year - 1, 12) if self.month == 1 else Month(self.year, self.month - 1)
        )

    @property
    def next(self) -> Month:
        return (
            Month(self.year + 1, 1) if self.month == 12 else Month(self.year, self.month + 1)
        )

    def __str__(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"


@dataclass(frozen=True, order=True)
class Week:
    """A Monday-to-Sunday week, identified by its Monday (CONTEXT.md: Week, as in
    Ventas)."""

    monday: date

    @classmethod
    def containing(cls, day: date) -> Week:
        return cls(day - timedelta(days=day.weekday()))

    @property
    def first_day(self) -> date:
        return self.monday

    @property
    def last_day(self) -> date:
        return self.monday + timedelta(days=6)

    @property
    def next_first_day(self) -> date:
        return self.monday + timedelta(days=7)

    @property
    def previous(self) -> Week:
        return Week(self.monday - timedelta(days=7))
