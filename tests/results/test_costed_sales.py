"""`costed_sales` with no infrastructure (CODING_STANDARDS §5, ADR-0020): a line's
sales, over its costed grams only, rounded once per line."""

from app.results.domain.costed_sales import costed_sales
from app.shared.quantity import Quantity


def test_a_fully_costed_line_counts_its_whole_total() -> None:
    assert costed_sales(10_000, Quantity.of(10), Quantity.of(0)) == 10_000


def test_a_fully_pending_line_counts_nothing() -> None:
    assert costed_sales(10_000, Quantity.of(10), Quantity.of(10)) == 0


def test_a_gift_counts_nothing_whatever_its_pending_grams() -> None:
    assert costed_sales(0, Quantity.of(10), Quantity.of(4)) == 0


def test_the_split_line_from_the_margin_matrix_rounds_half_up() -> None:
    # 10 g sold for $10.000, 6 g costed, 4 g pending: 10_000 * 6/10 = 6_000 exactly.
    assert costed_sales(10_000, Quantity.of(10), Quantity.of(4)) == 6_000


def test_a_split_that_does_not_divide_evenly_rounds_half_up() -> None:
    # 3 g sold for $100, 1 g costed: 100 * 1/3 = 33.33..., half up to 33.
    assert costed_sales(100, Quantity.of(3), Quantity.of(2)) == 33
    # 3 g sold for $100, 2 g costed: 100 * 2/3 = 66.66..., half up to 67.
    assert costed_sales(100, Quantity.of(3), Quantity.of(1)) == 67


def test_a_costed_share_ending_exactly_on_half_goes_up() -> None:
    # 10 g sold for $25, 1 g costed: 25 * 1/10 = 2.5 exactly, half up to 3.
    assert costed_sales(25, Quantity.of(10), Quantity.of(9)) == 3


def test_a_costed_share_just_below_half_stays_down() -> None:
    # 10 g sold for $24, 1 g costed: 24 * 1/10 = 2.4, down to 2.
    assert costed_sales(24, Quantity.of(10), Quantity.of(9)) == 2
    # 200 g sold for $499, 1 g costed: 499 / 200 = 2.495, still down to 2.
    assert costed_sales(499, Quantity.of(200), Quantity.of(199)) == 2
