"""Hoy, Semana and Mes (docs/product/results.md), in Argentina time: the one place
these three bounds are derived from "today" (plan invariant) — ports, the route and
the front's own `periods.ts` all read them from here or from the one shared
`web/src/format/periods.vectors.json`, never recomputing a bound of their own.

Semana is the Monday-to-Sunday week containing today (PRD: "Behaviour, Periods"),
built from `app/shared/calendar`'s `Week.containing`. Mes is today's calendar month,
first day to last, from that same module's `Month.containing` — the one place a
week's start or a month's last day is derived (plan invariant); this module computes
neither bound on its own.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import ClassVar

from app.shared.calendar import Month, Week


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
    """`today` is today..today; `week` is the Monday..Sunday week containing it
    (`Week.containing`); `month` is the first..last day of today's calendar month
    (`Month.containing`) — both from `app/shared/calendar`, never derived here."""
    week = Week.containing(today)
    month = Month.containing(today)
    return Periods(
        today=Period(today, today),
        week=Period(week.first_day, week.last_day),
        month=Period(month.first_day, month.last_day),
    )
