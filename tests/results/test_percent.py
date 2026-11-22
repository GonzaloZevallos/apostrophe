"""`app/results/domain/rounding.percent` (domain unit test, no infrastructure). These
tests used to sit in `test_arithmetic.py`, beside the Average sale tests that moved to
`tests/shared/test_average.py`."""

from app.results.domain.rounding import percent


def test_percent_on_a_positive_tie_goes_up() -> None:
    # 5 / 200 = 2.5 %: half up to 3.
    assert percent(5, 200) == 3
    # 499 / 20000 = 2.495 %: just below the tie, down to 2.
    assert percent(499, 20_000) == 2


def test_percent_keeps_its_own_negative_tie_toward_positive_infinity() -> None:
    """A ratio is not money: -2.5 % stays -2 (`floor(x + 1/2)`), never the -3 the
    money helpers' away-from-zero tie would give."""
    assert percent(-5, 200) == -2
    assert percent(-499, 20_000) == -2
    assert percent(-501, 20_000) == -3


def test_percent_is_none_over_a_zero_base() -> None:
    assert percent(5, 0) is None
