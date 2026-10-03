"""Hoy, Semana and Mes (docs/product/results.md), in Argentina time: the one place
these three bounds are derived from "today" (plan invariant) — ports, the route and
the front's own `periods.ts` all read them from here or from the one shared
`web/src/format/periods.vectors.json`, never recomputing a bound of their own.

Semana is the Monday-to-Sunday week containing today (PRD: "Behaviour, Periods").
Mes is today's calendar month, first day to last.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from typing import ClassVar


class InvalidPeriod(ValueError):
    code: ClassVar[str] = "results.period_invalid"


@dataclass(frozen=True)
class Period:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise InvalidPeriod("a period cannot end before it starts")


@dataclass(frozen=True)
class Periods:
    today: Period
    week: Period
    month: Period


def periods(today: date) -> Periods:
    """`today` is today..today; `week` is the Monday..Sunday week containing it;
    `month` is the first..last day of today's calendar month."""
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    month_start = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    month_end = today.replace(day=last_day)
    return Periods(
        today=Period(today, today),
        week=Period(monday, sunday),
        month=Period(month_start, month_end),
    )
