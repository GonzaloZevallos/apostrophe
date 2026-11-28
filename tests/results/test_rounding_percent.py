"""Pins `app.results.domain.rounding.percent` before its formula moves to
`app/shared/ratio.py` (domain unit test, no infrastructure): ties at +x.5 and -x.5 with
`floor(x + 1/2)`, negatives, a zero base, large values."""

import pytest

from app.results.domain.rounding import percent


@pytest.mark.parametrize(
    ("amount", "base", "expected"),
    [
        (5, 200, 3),  # +2.5 % goes up
        (15, 200, 8),  # +7.5 % goes up
        (499, 20_000, 2),  # +2.495 % just under the tie
        (501, 20_000, 3),  # +2.505 % just over the tie
        (-5, 200, -2),  # -2.5 % goes toward +infinity: -2, never -3
        (-15, 200, -7),  # -7.5 % goes toward +infinity: -7
        (-499, 20_000, -2),  # -2.495 % just over the tie, toward zero
        (-501, 20_000, -3),  # -2.505 % just under the tie
        (1, 2, 50),
        (1, 3, 33),
        (2, 3, 67),
        (-1, 3, -33),
        (-2, 3, -67),
        (0, 7, 0),
        (-1, 200, 0),  # -0.5 % ties up to 0
        (-3, 200, -1),  # -1.5 % ties up to -1
    ],
)
def test_percent_rounds_half_up_with_floor_of_x_plus_one_half(
    amount: int, base: int, expected: int
) -> None:
    assert percent(amount, base) == expected


@pytest.mark.parametrize("amount", [0, 5, -5, 10**18])
def test_percent_over_a_zero_base_is_none(amount: int) -> None:
    assert percent(amount, 0) is None


def test_percent_is_exact_on_large_values() -> None:
    big = 10**30
    assert percent(big, big) == 100
    assert percent(big + 1, 3 * big) == 33
    assert percent(-(10**30) * 5, 2 * 10**32) == -2  # -2.5 % exactly
    assert percent(10**30 * 5, 2 * 10**32) == 3
    assert percent(10**24 * 3, 10**24 * 8) == 38  # 37.5 % ties up
