"""Today's Sales by hour and the so-far comparison, the last 7 days of Sales and today's
money in by Payment method (GH-497). Pure: the time zone comes in
as a `tzinfo` argument, never from `app.clock` or `zoneinfo`.

A Sale counts on its own date (`SaleRecord.day`). One recorded on that date counts at its
local hour; one recorded on any other day, earlier or later, counts at the end of its date
(hour 23) and is in no so-far window, so a comparison against the same weekday last week
stays fair. `_recorded_local` is the one place an instant becomes a local time, truncated to
the whole second, and every function checks `sale.day` before calling it.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, tzinfo
from itertools import accumulate

from app.results.domain.ledger import PaymentMethodRecord, SaleRecord
from app.results.domain.period_figures import Buckets
from app.results.domain.rounding import percent
from app.shared.calendar import local_day

LAST_HOUR = 23


def _recorded_local(recorded_at: datetime, tz: tzinfo) -> datetime:
    return recorded_at.astimezone(tz).replace(microsecond=0)


def _local_on(recorded_at: datetime, day: date, tz: tzinfo) -> datetime | None:
    """The local time a Sale dated `day` was recorded at, or `None` when it was recorded
    on another day: the one rule for "recorded on its own date"."""
    local = _recorded_local(recorded_at, tz)
    return local if local_day(local, tz) == day else None


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


SERIES_DAYS = 7


@dataclass(frozen=True)
class DaySales:
    day: date
    sales: int


@dataclass(frozen=True)
class MethodMoney:
    payment_method_id: int
    name: str
    amount: int


@dataclass(frozen=True)
class MoneyIn:
    total: int
    methods: tuple[MethodMoney, ...]


class PaymentMethodMissing(LookupError):
    """A Payment points at a method the business does not list: a broken read. The
    message is fixed: it carries no id, name or amount."""

    def __init__(self) -> None:
        super().__init__("a payment's method is not among the business's payment methods")


def last_7_days(buckets: Buckets, today: date) -> tuple[DaySales, ...]:
    """`today` and the 6 days before it, oldest first. Each day reads the same
    `Buckets.sales` every Sales total reads, so a day on its own never disagrees with
    `totals_between`."""
    days = (today - timedelta(days=back) for back in range(SERIES_DAYS - 1, -1, -1))
    return tuple(DaySales(day=day, sales=buckets.sales(day, day)) for day in days)


def money_in(buckets: Buckets, methods: Sequence[PaymentMethodRecord], today: date) -> MoneyIn:
    """Payments dated `today` by method, from the same buckets as Cash's Payments
    received: only methods with a Payment today, archived ones included, each under its
    current name, by `position` then `payment_method_id`."""
    paid = buckets.payments_by_day_method.get(today, {})
    by_id = {method.payment_method_id: method for method in methods}
    if set(paid) - set(by_id):
        raise PaymentMethodMissing
    ordered = sorted(
        (by_id[method_id] for method_id in paid),
        key=lambda method: (method.position, method.payment_method_id),
    )
    lines = tuple(
        MethodMoney(method.payment_method_id, method.name, paid[method.payment_method_id])
        for method in ordered
    )
    return MoneyIn(total=sum(line.amount for line in lines), methods=lines)
