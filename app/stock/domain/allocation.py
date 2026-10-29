"""FIFO allocation of grams going out against a variety's lots, oldest first
(CONTEXT.md: Draw, Pending cost, Cost of goods sold; ADR-0009).

The one place a line's cost of goods, a lot's draws and pending grams are computed
(the plan's invariant): no other code multiplies grams by a cost per gram or rounds a
cost of goods. Every intermediate figure is exact — `Fraction` over hundredths of a
gram and whole pesos — until the one rounding a draw ever gets: once, over everything
it took from every lot it touched. No `float`, `round()` or `Decimal.quantize`
anywhere here.

Because every lot boundary (one or several whole lots in a row) lands on an exact
integer cumulative cost — a sum of whole-peso `total_cost`s — rounding only at each
draw's start and end and taking the difference telescopes exactly: a lot that is fully
drawn, across however many draws it takes, always sums to exactly its own cost.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from fractions import Fraction

from app.shared.quantity import Quantity
from app.stock.domain.lot_order import Draw, Lot


@dataclass(frozen=True)
class LotDraw:
    """Exact grams and cost one draw took from one lot, before the draw's own total
    is rounded once over every lot it touched. For tests only (lot conservation):
    production code reads `DrawCost`, never this."""

    lot_ref: int
    quantity: Quantity
    cost: Fraction


@dataclass(frozen=True)
class DrawCost:
    """One draw's answer. `costed` is `None` exactly when none of the draw's grams
    came from a lot — pending is carried as `Quantity`, never a $0 cost; a costed part
    of `0` only ever comes from a lot with no recorded cost. `pending` is the part of
    the draw past every lot's grams."""

    costed: int | None
    pending: Quantity
    lot_draws: tuple[LotDraw, ...]


def _half_up(amount: Fraction) -> int:
    """`floor(amount + 1/2)`, exact over `Fraction` — no float anywhere."""
    return math.floor(amount + Fraction(1, 2))


def allocate(lots: list[Lot], draws: list[Draw]) -> list[DrawCost]:
    """`lots` and `draws` must already be one variety's own, each in `LotOrder`
    (`lots_and_draws`'s own job, not this function's). Draws grams off the lots in
    order, oldest first; grams past every lot's own are pending, never costed."""
    lot_index = 0
    drawn_from_lot = 0  # hundredths already taken from lots[lot_index]
    cumulative_cost = Fraction(0)
    previous_rounded = 0

    results: list[DrawCost] = []
    for draw in draws:
        remaining = draw.quantity.hundredths
        lot_draws: list[LotDraw] = []
        while remaining > 0 and lot_index < len(lots):
            lot = lots[lot_index]
            available = lot.quantity.hundredths - drawn_from_lot
            if available <= 0:
                lot_index += 1
                drawn_from_lot = 0
                continue
            take = min(available, remaining)
            cost = (
                Fraction(lot.total_cost, lot.quantity.hundredths) * take
                if lot.total_cost is not None
                else Fraction(0)
            )
            cumulative_cost += cost
            lot_draws.append(LotDraw(lot.order.ref_id, Quantity(take), cost))
            drawn_from_lot += take
            remaining -= take
            if drawn_from_lot >= lot.quantity.hundredths:
                lot_index += 1
                drawn_from_lot = 0

        rounded = _half_up(cumulative_cost)
        costed = rounded - previous_rounded if lot_draws else None
        previous_rounded = rounded
        results.append(DrawCost(costed, Quantity(remaining), tuple(lot_draws)))
    return results
