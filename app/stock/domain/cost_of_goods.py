"""A period's cost of goods sold (CONTEXT.md: Cost of goods sold; ADR-0009, ADR-0010;
plan invariant: a period's cost of goods is the sum of `allocate`'s per-draw `costed`
(None as 0) over sale-line draws dated in the period, with `allocate` run unchanged
over each variety's full history).

`allocate` always runs over a whole variety's history — never a date-narrowed load —
so a draw's cost never depends on where a period's edge happens to fall. Only the
result is narrowed, by date, once `allocate` has already answered.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date

from app.stock.domain.allocation import allocate
from app.stock.domain.lot_order import SALE_LINE_RANK, Draw, Lot


@dataclass(frozen=True)
class CostOfGoods:
    """Stock's own answer: results never imports this (ADR-0006) — its `StockFigures`
    port answers results' own `CostOfGoods` instead, translated by the adapter."""

    amount: int
    pending: bool


def cost_of_goods(
    grouped: Mapping[int, tuple[list[Lot], list[Draw]]], start: date, end: date
) -> CostOfGoods:
    """Sums `DrawCost.costed` (`None` as 0) over every variety's sale-line draws dated
    in `[start, end]`, running `allocate` once per variety over its own full history.
    A negative adjustment is never a sale-line draw (`SALE_LINE_RANK`): its cost is
    never summed here, and it never sets `pending`."""
    amount = 0
    pending = False
    for lots, draws in grouped.values():
        for draw, result in zip(draws, allocate(lots, draws), strict=True):
            if draw.order.rank != SALE_LINE_RANK:
                continue
            if not (start <= draw.order.day <= end):
                continue
            amount += result.costed or 0
            if result.pending.hundredths > 0:
                pending = True
    return CostOfGoods(amount, pending)
