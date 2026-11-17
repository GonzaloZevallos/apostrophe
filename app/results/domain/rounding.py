"""The one rounding results does to a ratio: half up, exact over `Fraction` (ADR-0020,
CODING_STANDARDS.md's invariant — no `float`, `round()` or `Decimal.quantize` in any
results percentage path). A percentage is a ratio, not money, so it never goes through
the money helpers in `app/shared/money.py` (ADR-0058): `percent` keeps negatives as
negatives with `floor(x + 1/2)`, which is not symmetric, and the plan declares it the
one rule anyway."""

from __future__ import annotations

import math
from fractions import Fraction


def _round_ratio_half_up(ratio: Fraction) -> int:
    """`floor(ratio + 1/2)`, exact over `Fraction`."""
    return math.floor(ratio + Fraction(1, 2))


def percent(amount: int, base: int) -> int | None:
    """A whole percentage of `amount` over `base`, half up; `None` when `base` is 0,
    never a division by zero and never a `float`."""
    if base == 0:
        return None
    return _round_ratio_half_up(Fraction(amount * 100, base))
