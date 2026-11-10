"""`app/results/domain/arithmetic.py` (CODING_STANDARDS section 5: domain unit test,
no infrastructure). PRD criterion 3: the half-up average, and `None` with no sales.

`profit` and `cash` moved to `period_figures` (GH-70, ADR-0013 amendment): see
`tests/results/test_period_figures.py`'s `totals_between` tests instead.
"""

from app.results.domain.arithmetic import average_sale
from app.results.domain.rounding import percent


def test_average_sale_rounds_half_up_to_the_whole_peso() -> None:
    # 7 / 2 = 3.5, rounds up to 4, never down to 3 (banker's rounding would floor it).
    assert average_sale(total=7, count=2) == 4


def test_average_sale_divides_evenly_when_it_already_is_whole() -> None:
    assert average_sale(total=15_000, count=2) == 7_500


def test_average_sale_is_none_with_no_sales() -> None:
    """The enforcement this guards: a period with no sales must show nothing, never a
    computed `$0` average (PRD: "Average sale shows nothing when the period has no
    sales")."""
    assert average_sale(total=0, count=0) is None


def test_average_sale_on_a_tie_goes_up_and_just_below_it_stays_down() -> None:
    assert average_sale(total=5, count=2) == 3
    # 499 / 200 = 2.495, just below the tie.
    assert average_sale(total=499, count=200) == 2


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
