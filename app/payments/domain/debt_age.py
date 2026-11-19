"""Debt age: how long each Sale still owing has been owed, bucketed (docs/adr/20261119-*).

Age is per Sale still owing over Settlement, never per Customer, and comes only from
`settle()`'s `SaleSettlement` values and this module. `today` is always a parameter: the
domain reads no clock. A Credit never enters, so the three buckets add up to Total owed.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.payments.domain.settlement import SaleSettlement

DebtAgeBucket = Literal["this_week", "days_8_30", "over_30"]


def age_in_days(on: date, today: date) -> int:
    """Whole days from `on` to `today`; a date in the future counts as `0`."""
    return max(0, (today - on).days)


def bucket_of(days: int) -> DebtAgeBucket:
    """`0`-`7` days is this week, `8`-`30` is `days_8_30`, `31` and more is `over_30`."""
    if days < 0:
        raise ValueError(f"age in days cannot be negative: {days}")
    if days <= 7:
        return "this_week"
    if days <= 30:
        return "days_8_30"
    return "over_30"


@dataclass(frozen=True)
class DebtAgeBuckets:
    this_week: int
    days_8_30: int
    over_30: int

    def __post_init__(self) -> None:
        for name, value in (
            ("this_week", self.this_week),
            ("days_8_30", self.days_8_30),
            ("over_30", self.over_30),
        ):
            if value < 0:
                raise ValueError(f"{name} cannot be negative: {value}")

    @property
    def total(self) -> int:
        return self.this_week + self.days_8_30 + self.over_30


def buckets(settlements: Iterable[SaleSettlement], today: date) -> DebtAgeBuckets:
    """Each remainder above zero goes into the bucket of its own Sale's date."""
    sums: dict[DebtAgeBucket, int] = {"this_week": 0, "days_8_30": 0, "over_30": 0}
    for settlement in settlements:
        if settlement.still_owed > 0:
            sums[bucket_of(age_in_days(settlement.sale_date, today))] += settlement.still_owed
    return DebtAgeBuckets(sums["this_week"], sums["days_8_30"], sums["over_30"])
