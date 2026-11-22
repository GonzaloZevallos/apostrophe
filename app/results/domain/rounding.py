"""The one rounding results does to a ratio: half up, exact over `Fraction` (ADR-0020,
CODING_STANDARDS.md's invariant — no `float`, `round()` or `Decimal.quantize` in any
results percentage path). A percentage is a ratio, not money, so it never goes through
the money helpers in `app/shared/money.py` (ADR-0058): it goes through
`app.shared.ratio.round_ratio_half_up` (`floor(x + 1/2)`, not symmetric on negatives)."""

from __future__ import annotations

from fractions import Fraction

from app.shared.ratio import round_ratio_half_up


def percent(amount: int, base: int) -> int | None:
    """A whole percentage of `amount` over `base`, half up; `None` when `base` is 0,
    never a division by zero and never a `float`."""
    if base == 0:
        return None
    return round_ratio_half_up(Fraction(amount * 100, base))
