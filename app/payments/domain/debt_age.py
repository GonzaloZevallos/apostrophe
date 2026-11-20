"""Debt age: how long each Sale still owing has been owed, bucketed (docs/adr/20261119-*).

The buckets are per Sale still owing over Settlement and come from `settle()`'s
`SaleSettlement` values; the limits and `age_in_days` live in `app.shared.debt_age`.
`today` is always a parameter: the domain reads no clock. A Credit never enters, so the
three buckets add up to Total owed.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.payments.domain.settlement import SaleSettlement
from app.shared.debt_age import RECENT_UP_TO_DAYS, WARNING_UP_TO_DAYS, age_in_days

DebtAgeBucket = Literal["this_week", "days_8_30", "over_30"]


def bucket_of(days: int) -> DebtAgeBucket:
    """Up to `RECENT_UP_TO_DAYS` is this week, up to `WARNING_UP_TO_DAYS` is `days_8_30`,
    and anything older is `over_30`."""
    if days < 0:
        raise ValueError(f"age in days cannot be negative: {days}")
    if days <= RECENT_UP_TO_DAYS:
        return "this_week"
    if days <= WARNING_UP_TO_DAYS:
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
