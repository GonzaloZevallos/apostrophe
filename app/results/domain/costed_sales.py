"""`costed_sales`: a sale line's sales, over its costed grams only (ADR-0020, PM
clarification round 1 Q2). Sales of costed grams are rounded once per line, here; a
line's pending sales are always `line_total - costed_sales(...)` (the plan's
invariant) — no other code rounds a line's sales again."""

from __future__ import annotations

from fractions import Fraction

from app.results.domain.rounding import half_up
from app.shared.quantity import Quantity


def costed_sales(line_total: int, quantity: Quantity, pending: Quantity) -> int:
    """`line_total x costed_quantity / quantity`, half up. A fully costed line (`pending`
    zero) counts its whole total; a fully pending line (`pending == quantity`, a gift
    included, since a gift's `line_total` is already 0) counts $0."""
    costed_hundredths = quantity.hundredths - pending.hundredths
    if costed_hundredths == quantity.hundredths:
        return line_total
    if costed_hundredths == 0:
        return 0
    return half_up(Fraction(line_total * costed_hundredths, quantity.hundredths))
