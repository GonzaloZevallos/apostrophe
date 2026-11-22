"""The one rounding of a ratio to a whole number: half up, exact over `Fraction`
(ADR-0020: no `float`, `round()` or `Decimal.quantize` in a percentage path).

A ratio is not money, so it does not go through `app/shared/money.py`. The two differ on
a negative tie: here `floor(x + 1/2)` sends -1/2 to 0 (toward +infinity), while
`round_half_up_to_units` sends a tie away from zero, so -1/2 of a unit is -1."""

from __future__ import annotations

import math
from fractions import Fraction


def round_ratio_half_up(ratio: Fraction) -> int:
    """`floor(ratio + 1/2)`, exact over `Fraction`."""
    return math.floor(ratio + Fraction(1, 2))
