"""The day-total helpers `Buckets` stands on: `row_cost`, the only place a cost line's
`all_pending` is decided, the per-day totals and the day range (ADR-0020)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from app.results.domain.figures import RowCost
from app.shared.quantity import Quantity

ZERO = Quantity(0)


def row_cost(amount: int, pending_quantity: Quantity, quantity: Quantity) -> RowCost:
    """A cost line's costed amount and pending grams, with `all_pending` set exactly
    when there are grams and every one is pending. The only place that rule exists:
    a lot costed at $0 (a harvest) is costed, so "amount == 0" is not the test."""
    return RowCost(
        amount=amount,
        pending_quantity=pending_quantity,
        all_pending=quantity.is_positive and pending_quantity == quantity,
    )


def _line_cost(days: Sequence[_CostDayTotals]) -> RowCost | None:
    """The sum of one cost line's day buckets, `None` with no day at all."""
    if not days:
        return None
    pending = ZERO
    quantity = ZERO
    for day_totals in days:
        pending = pending + day_totals.pending_quantity
        quantity = quantity + day_totals.quantity
    return row_cost(sum(t.costed for t in days), pending, quantity)


def _days(start: date, end_inclusive: date) -> list[date]:
    if start > end_inclusive:
        return []
    count = (end_inclusive - start).days + 1
    return [start + timedelta(days=i) for i in range(count)]


@dataclass
class _DayTotals:
    sales_without_shipping: int = 0
    quantity: Quantity = ZERO
    quantity_sold: Quantity = ZERO
    quantity_gifted: Quantity = ZERO
    costed_cost: int = 0
    sales_of_costed: int = 0
    pending_quantity: Quantity = ZERO


@dataclass
class _VarietyDayTotals:
    sales_without_shipping: int = 0
    quantity_sold: Quantity = ZERO
    quantity_gifted: Quantity = ZERO
    costed_cost: int = 0
    sales_of_costed: int = 0
    pending_quantity: Quantity = ZERO


@dataclass
class _CostDayTotals:
    """One day's costed amount and pending grams of one cost line: the stock shortfall
    or one withdrawal reason."""

    costed: int = 0
    pending_quantity: Quantity = ZERO
    quantity: Quantity = ZERO
