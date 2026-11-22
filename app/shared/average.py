"""The Average sale rounding, shared by Results' panel and Payments' account read so the
two can never disagree. Pure, no infrastructure: `average_sale` rounds half up to the
whole unit of the stored amount and is `None` with no sales, never a `0`.

It moved here from `app/results/domain/arithmetic.py` (GH-498 part 3). The shared
kernel's modules import only the standard library (`tests/architecture`), so the half-up
step is written here in integers instead of imported from `app.shared.money`; a test in
`tests/shared/test_average.py` keeps it equal to `round_half_up_to_units`."""

from __future__ import annotations

from fractions import Fraction


def average_sale(total: int, count: int) -> int | None:
    """`None` when `count` is 0 (PRD: "Average sale shows nothing when the period has
    no sales"), otherwise `total / count` rounded half up (away from zero on a tie) to
    the whole unit of the stored amount."""
    if count == 0:
        return None
    value = Fraction(total, count)
    numerator, denominator = value.numerator, value.denominator
    rounded, _ = divmod(2 * abs(numerator) + denominator, 2 * denominator)
    return -rounded if numerator < 0 else rounded
