"""An entry's own cost per gram, for display only (CONTEXT.md: Cost of goods sold).

Rounds half up over integer hundredths, with no float, `round()` or
`Decimal.quantize`. `allocate` (the lot-draw engine) never reads this: it is shown
next to an entry, never used to cost a draw.
"""

from __future__ import annotations

from app.shared.grams import HUNDREDTHS_PER_GRAM, Grams


def cost_per_gram(total_cost: int, grams: Grams) -> int:
    """`total_cost` over `grams`, rounded half up to the nearest whole peso. `grams`
    must be positive: a priced lot's own entry already guarantees it."""
    assert grams.is_positive, "cost per gram is computed over positive grams"
    h = grams.hundredths
    numerator = 2 * total_cost * HUNDREDTHS_PER_GRAM + h
    return numerator // (2 * h)
