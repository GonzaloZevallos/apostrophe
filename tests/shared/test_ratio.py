"""`app.shared.ratio.round_ratio_half_up` (domain unit test, no infrastructure): the one
ratio rounding, `floor(x + 1/2)`, exact over `Fraction`."""

from fractions import Fraction

import pytest

from app.shared.money import round_half_up_to_units
from app.shared.ratio import round_ratio_half_up


@pytest.mark.parametrize(
    ("ratio", "expected"),
    [
        (Fraction(5, 2), 3),
        (Fraction(-5, 2), -2),
        (Fraction(250, 3), 83),
        (Fraction(-250, 3), -83),
        (Fraction(499, 200), 2),  # just under the tie
        (Fraction(501, 200), 3),  # just over the tie
        (Fraction(-499, 200), -2),  # just over the tie on the negative side
        (Fraction(-501, 200), -3),  # just under the tie on the negative side
        (Fraction(0), 0),
        (Fraction(10**30 * 5, 2), 25 * 10**29),
        (Fraction(-(10**30) * 5, 2), -25 * 10**29),
    ],
)
def test_round_ratio_half_up(ratio: Fraction, expected: int) -> None:
    assert round_ratio_half_up(ratio) == expected


def test_a_large_tie_is_exact() -> None:
    assert round_ratio_half_up(Fraction(10**30 + 1, 2)) == 5 * 10**29 + 1
    assert round_ratio_half_up(Fraction(-(10**30) - 1, 2)) == -5 * 10**29


def test_it_disagrees_with_the_money_rule_at_a_negative_tie() -> None:
    """A ratio is not money: -1/2 goes toward +infinity here, away from zero there."""
    assert round_ratio_half_up(Fraction(-1, 2)) == 0
    assert round_half_up_to_units(Fraction(-1, 2)) == -1
