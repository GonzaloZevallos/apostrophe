"""The one rounding results ever does: half up, exact over `Fraction` (ADR-0013,
CODING_STANDARDS.md's invariant — no `float`, `round()` or `Decimal.quantize` in any
results money, grams or percentage path). `percent` keeps negatives as negatives:
`floor(x + 1/2)` is not symmetric, but the plan declares it the one rule anyway."""

from __future__ import annotations

import math
from fractions import Fraction


def half_up(amount: Fraction) -> int:
    """`floor(amount + 1/2)`, exact over `Fraction`."""
    return math.floor(amount + Fraction(1, 2))


def percent(amount: int, base: int) -> int | None:
    """A whole percentage of `amount` over `base`, half up; `None` when `base` is 0,
    never a division by zero and never a `float`."""
    if base == 0:
        return None
    return half_up(Fraction(amount * 100, base))
