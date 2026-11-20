"""`app/results/domain/today_ordering.py` (domain unit test, no infrastructure). PRD "Today
read model": low stock in order (sold out first, then low; fewest Days left first, none
last, then name) and this week's best sellers (stored line totals, Gifts at $0, $0 dropped,
top 4)."""

from datetime import date

import pytest

from app.results.application.ports import StockRow, StockStatus
from app.results.domain.ledger import DrawKind, DrawRow
from app.results.domain.today_ordering import (
    BEST_SELLERS_LIMIT,
    BestSeller,
    LowStock,
    best_sellers,
    low_stock,
)
from app.shared.quantity import Quantity

MONDAY = date(2026, 11, 16)
TODAY = date(2026, 11, 19)


def _row(
    variety_id: int,
    name: str,
    status: StockStatus,
    days_left: int | None = None,
    quantity: int = 0,
) -> StockRow:
    return StockRow(
        variety_id=variety_id,
        name=name,
        quantity=Quantity(quantity),
        status=status,
        sold_out_since=None,
        threshold=None,
        days_left=days_left,
    )


def _draw(
    variety_id: int,
    name: str,
    total: int,
    day: date = TODAY,
    kind: DrawKind = "sold",
    sale_id: int = 1,
) -> DrawRow:
    return DrawRow(
        kind=kind,
        day=day,
        variety_id=variety_id,
        variety_name=name,
        sale_id=sale_id,
        line_total=total,
        quantity=Quantity(100),
        costed=0,
        pending=Quantity(0),
    )


def _ids(answer: LowStock[StockRow]) -> list[int]:
    return [row.variety_id for row in answer.rows]


def test_sold_out_comes_before_low() -> None:
    answer = low_stock([_row(1, "Anis", "low", days_left=1), _row(2, "Zarzaparrilla", "sold_out")])

    assert _ids(answer) == [2, 1]


def test_days_left_ascending_inside_a_group() -> None:
    answer = low_stock(
        [
            _row(1, "Anis", "low", days_left=9),
            _row(2, "Boldo", "low", days_left=2),
            _row(3, "Cedron", "low", days_left=5),
        ]
    )

    assert _ids(answer) == [2, 3, 1]


def test_no_days_left_goes_last_inside_a_group() -> None:
    answer = low_stock(
        [
            _row(1, "Anis", "low", days_left=None),
            _row(2, "Boldo", "low", days_left=40),
        ]
    )

    assert _ids(answer) == [2, 1]


def test_a_zero_days_left_is_not_taken_for_none() -> None:
    answer = low_stock(
        [_row(1, "Anis", "low", days_left=None), _row(2, "Boldo", "low", days_left=0)]
    )

    assert _ids(answer) == [2, 1]


def test_ties_go_by_folded_name_then_id() -> None:
    answer = low_stock(
        [
            _row(5, "Úrsula", "sold_out"),
            _row(4, "Ursula", "sold_out"),
            _row(3, "arrayan", "sold_out"),
        ]
    )

    assert _ids(answer) == [3, 4, 5]


def test_no_entries_and_ok_are_excluded() -> None:
    answer = low_stock(
        [
            _row(1, "Anis", "no_entries"),
            _row(2, "Boldo", "ok", quantity=500),
            _row(3, "Cedron", "low", quantity=10),
        ]
    )

    assert _ids(answer) == [3]


def test_a_negative_quantity_is_kept_as_stored() -> None:
    answer = low_stock([_row(1, "Anis", "sold_out", quantity=-250)])

    assert answer.rows[0].quantity == Quantity(-250)


def test_the_count_is_the_number_of_rows() -> None:
    answer = low_stock(
        [_row(1, "Anis", "low"), _row(2, "Boldo", "sold_out"), _row(3, "Cedron", "ok")]
    )

    assert answer.count == len(answer.rows) == 2


def test_nothing_low_answers_an_empty_block() -> None:
    assert low_stock([]) == LowStock(count=0, rows=())


def test_a_low_stock_whose_count_disagrees_with_its_rows_is_refused() -> None:
    with pytest.raises(ValueError, match="count must equal the number of rows"):
        LowStock(count=2, rows=(_row(1, "Anis", "low"),))


def test_a_gift_counts_zero_even_with_a_stored_total() -> None:
    answer = best_sellers(
        [_draw(1, "Anis", 900, kind="gifted"), _draw(1, "Anis", 300, sale_id=2)],
        MONDAY,
        TODAY,
    )

    assert answer == (BestSeller(variety_id=1, name="Anis", sales=300),)


def test_the_stored_line_total_is_summed_as_charged() -> None:
    answer = best_sellers(
        [_draw(1, "Anis", 1_234, sale_id=1), _draw(1, "Anis", 766, sale_id=2)], MONDAY, TODAY
    )

    assert answer == (BestSeller(variety_id=1, name="Anis", sales=2_000),)


def test_a_product_at_zero_is_dropped() -> None:
    answer = best_sellers(
        [_draw(1, "Anis", 0), _draw(2, "Boldo", 10, kind="gifted")],
        MONDAY,
        TODAY,
    )

    assert answer == ()


def test_ties_go_by_folded_name_then_id_and_the_biggest_sales_first() -> None:
    answer = best_sellers(
        [
            _draw(1, "Zeta", 500),
            _draw(2, "Úrsula", 500, sale_id=2),
            _draw(3, "Ursula", 500, sale_id=3),
            _draw(4, "Mayor", 800, sale_id=4),
        ],
        MONDAY,
        TODAY,
    )

    assert [seller.variety_id for seller in answer] == [4, 2, 3, 1]


def test_only_the_top_four_are_kept() -> None:
    draws = [_draw(n, f"P{n}", n * 100, sale_id=n) for n in range(1, 7)]

    answer = best_sellers(draws, MONDAY, TODAY)

    assert len(answer) == BEST_SELLERS_LIMIT == 4
    assert [seller.variety_id for seller in answer] == [6, 5, 4, 3]


def test_monday_is_in_and_the_day_after_today_is_out() -> None:
    answer = best_sellers(
        [
            _draw(1, "Anis", 100, day=MONDAY),
            _draw(2, "Boldo", 200, day=date(2026, 11, 20), sale_id=2),
            _draw(3, "Cedron", 400, day=date(2026, 11, 15), sale_id=3),
        ],
        MONDAY,
        TODAY,
    )

    assert [seller.variety_id for seller in answer] == [1]


def test_only_sale_lines_count() -> None:
    withdrawal = DrawRow(
        kind="withdrawal",
        day=TODAY,
        variety_id=None,
        variety_name=None,
        sale_id=None,
        line_total=None,
        quantity=Quantity(100),
        costed=0,
        pending=Quantity(0),
        reason_id=1,
    )

    assert best_sellers([withdrawal], MONDAY, TODAY) == ()


def test_nothing_sold_answers_an_empty_list() -> None:
    assert best_sellers([], MONDAY, TODAY) == ()


def test_two_names_for_one_product_are_refused_without_naming_either() -> None:
    draws = [_draw(1, "Anis", 100), _draw(1, "Aniz", 100, sale_id=2)]

    with pytest.raises(ValueError, match="^one product carries two names$"):
        best_sellers(draws, MONDAY, TODAY)
