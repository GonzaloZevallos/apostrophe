"""`costed_sales` with no infrastructure (CODING_STANDARDS §5, ADR-0013): a line's
sales, over its costed grams only, rounded once per line."""

from app.results.domain.costed_sales import costed_sales
from app.shared.grams import Grams


def test_a_fully_costed_line_counts_its_whole_total() -> None:
    assert costed_sales(10_000, Grams.of(10), Grams.of(0)) == 10_000


def test_a_fully_pending_line_counts_nothing() -> None:
    assert costed_sales(10_000, Grams.of(10), Grams.of(10)) == 0


def test_a_gift_counts_nothing_whatever_its_pending_grams() -> None:
    assert costed_sales(0, Grams.of(10), Grams.of(4)) == 0


def test_the_split_line_from_the_margin_matrix_rounds_half_up() -> None:
    # 10 g sold for $10.000, 6 g costed, 4 g pending: 10_000 * 6/10 = 6_000 exactly.
    assert costed_sales(10_000, Grams.of(10), Grams.of(4)) == 6_000


def test_a_split_that_does_not_divide_evenly_rounds_half_up() -> None:
    # 3 g sold for $100, 1 g costed: 100 * 1/3 = 33.33..., half up to 33.
    assert costed_sales(100, Grams.of(3), Grams.of(2)) == 33
    # 3 g sold for $100, 2 g costed: 100 * 2/3 = 66.66..., half up to 67.
    assert costed_sales(100, Grams.of(3), Grams.of(1)) == 67
