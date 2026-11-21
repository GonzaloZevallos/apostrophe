"""The Average sale rounding, shared by Results' panel and Payments' account read so the
two can never disagree. Pure, no infrastructure: `average_sale` rounds half up to the
whole unit of the stored amount and is `None` with no sales, never a `0`.

It moved here unchanged from `app/results/domain/arithmetic.py` (GH-498 part 3)."""

from __future__ import annotations

from fractions import Fraction

from app.shared.money import round_half_up_to_units


def average_sale(total: int, count: int) -> int | None:
    """`None` when `count` is 0 (PRD: "Average sale shows nothing when the period has
    no sales"), otherwise `total / count` rounded half up to the whole unit of the
    stored amount through `round_half_up_to_units`."""
    if count == 0:
        return None
    return round_half_up_to_units(Fraction(total, count))
