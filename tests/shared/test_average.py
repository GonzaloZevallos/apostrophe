"""`app/shared/average.py` (CODING_STANDARDS section 5: domain unit test, no
infrastructure). PRD criterion 3: the half-up average, and `None` with no sales.

The helper moved here from `app/results/domain/arithmetic.py` (GH-498 part 3); the
assertions are the ones it always had.
"""

from app.shared.average import average_sale


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
