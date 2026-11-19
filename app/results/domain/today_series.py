"""Today's Sales by hour and the so-far comparison (GH-497). Pure: the time zone comes in
as a `tzinfo` argument, never from `app.clock` or `zoneinfo`.

A Sale counts on its own date (`SaleRecord.day`). One recorded on that date counts at its
local hour; one recorded on any other day, earlier or later, counts at the end of its date
(hour 23) and is in no so-far window, so a comparison against the same weekday last week
stays fair. `_recorded_local` is the one place an instant becomes a local time, truncated to
the whole second, and every function checks `sale.day` before calling it.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, time, tzinfo
from itertools import accumulate

from app.results.domain.ledger import SaleRecord
from app.results.domain.rounding import percent

LAST_HOUR = 23


def _recorded_local(recorded_at: datetime, tz: tzinfo) -> datetime:
    return recorded_at.astimezone(tz).replace(microsecond=0)


def _local_on(recorded_at: datetime, day: date, tz: tzinfo) -> datetime | None:
    """The local time a Sale dated `day` was recorded at, or `None` when it was recorded
    on another day: the one rule for "recorded on its own date"."""
    local = _recorded_local(recorded_at, tz)
    return local if local.date() == day else None


def recorded_on_own_date(sale: SaleRecord, tz: tzinfo) -> bool:
    return _local_on(sale.recorded_at, sale.day, tz) is not None


def hour_of(recorded_at: datetime, day: date, tz: tzinfo) -> int:
    """The local hour a Sale dated `day` counts at: its own when it was recorded that day,
    else the end of the day."""
    local = _local_on(recorded_at, day, tz)
    return LAST_HOUR if local is None else local.hour


def hourly_running_total(
    sales: Iterable[SaleRecord], day: date, tz: tzinfo, *, through_hour: int
) -> tuple[int, ...]:
    """The running total of `day`'s Sales (shipping included) for each hour 0..`through_hour`;
    it never falls back."""
    per_hour = [0] * (through_hour + 1)
    for sale in sales:
        if sale.day != day:
            continue
        hour = hour_of(sale.recorded_at, day, tz)
        if hour <= through_hour:
            per_hour[hour] += sale.total
    return tuple(accumulate(per_hour))


def so_far(sales: Iterable[SaleRecord], day: date, cut: time, tz: tzinfo) -> int:
    """`day`'s Sales recorded on their own date at or before `cut`, to the second."""
    total = 0
    for sale in sales:
        if sale.day != day:
            continue
        local = _local_on(sale.recorded_at, day, tz)
        if local is not None and local.time() <= cut:
            total += sale.total
    return total


def change_percent(so_far: int, base: int) -> int | None:
    return percent(so_far - base, base)
