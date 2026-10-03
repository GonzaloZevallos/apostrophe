"""`cost_of_goods`: a period's cost of goods sold, summed from `allocate`'s own answer
over each variety's full history (CODING_STANDARDS section 5: domain unit test, no
infrastructure; plan invariant for the panel's cost of goods).
"""

from __future__ import annotations

from datetime import date, datetime

from app.shared.grams import Grams
from app.stock.domain.cost_of_goods import CostOfGoods, cost_of_goods
from app.stock.domain.lot_order import Draw, Lot, LotOrder

AT = datetime(2026, 9, 1, 10, 0)
STOCK_ENTRY_RANK = 0
SALE_LINE_RANK = 1


def _lot(ref_id: int, grams: str, total_cost: int | None, day: date) -> Lot:
    return Lot(LotOrder(day, AT, STOCK_ENTRY_RANK, ref_id, 0), 1, Grams.of(grams), total_cost)


def _sale_draw(ref_id: int, grams: str, day: date, position: int = 0) -> Draw:
    return Draw(LotOrder(day, AT, SALE_LINE_RANK, ref_id, position), 1, Grams.of(grams))


def _adjustment(ref_id: int, grams: str, day: date) -> Draw:
    # A negative adjustment is a stock entry, never a sale line (`STOCK_ENTRY_RANK`).
    return Draw(LotOrder(day, AT, STOCK_ENTRY_RANK, ref_id, 0), 1, Grams.of(grams))


def test_it_equals_the_per_line_costed_amounts_of_the_periods_lines() -> None:
    lots = [_lot(1, "10", 1_000, date(2026, 9, 1))]
    draws = [
        _sale_draw(1, "4", date(2026, 9, 5)),
        _sale_draw(2, "6", date(2026, 9, 6)),
    ]
    grouped = {1: (lots, draws)}

    answer = cost_of_goods(grouped, date(2026, 9, 5), date(2026, 9, 5))

    assert answer == CostOfGoods(400, False)


def test_earlier_draws_still_consume_earlier_lots_whatever_the_period() -> None:
    """The second lot is cheaper per gram; a period narrowed to just the later sale
    must still cost it from whatever `allocate` left after the earlier one, not as if
    it were the first draw against a fresh variety."""
    lots = [
        _lot(1, "5", 1_000, date(2026, 9, 1)),  # $200/g
        _lot(2, "5", 500, date(2026, 9, 2)),  # $100/g
    ]
    draws = [
        _sale_draw(1, "4", date(2026, 9, 3)),  # 4g of lot 1: 800
        _sale_draw(2, "4", date(2026, 9, 10)),  # 1g of lot 1 (200) + 3g of lot 2 (300): 500
    ]
    grouped = {1: (lots, draws)}

    whole_history = cost_of_goods(grouped, date(2026, 9, 1), date(2026, 9, 30))
    just_the_later_sale = cost_of_goods(grouped, date(2026, 9, 10), date(2026, 9, 10))

    assert whole_history == CostOfGoods(1_300, False)
    assert just_the_later_sale == CostOfGoods(500, False)


def test_a_negative_adjustment_moves_later_sale_costs_but_is_not_summed() -> None:
    """The adjustment's own 3g draw costs 300, inside `allocate`'s input — but it is a
    stock entry, not a sale line, so it never enters the period's sum even though its
    date falls inside the window; it does, however, consume lot 1 first, which is why
    the later sale falls to lot 2's price instead of lot 1's."""
    lots = [
        _lot(1, "5", 500, date(2026, 9, 1)),  # $100/g
        _lot(2, "5", 1_000, date(2026, 9, 2)),  # $200/g
    ]
    draws = [
        _adjustment(1, "3", date(2026, 9, 3)),  # 3g of lot 1: 300, never summed
        _sale_draw(2, "4", date(2026, 9, 10)),  # 2g of lot 1 (200) + 2g of lot 2 (400): 600
    ]
    grouped = {1: (lots, draws)}

    answer = cost_of_goods(grouped, date(2026, 9, 1), date(2026, 9, 30))

    assert answer == CostOfGoods(600, False)


def test_the_pending_flag_is_true_only_when_a_sale_line_in_the_period_has_pending_grams() -> None:
    lots = [_lot(1, "2", 200, date(2026, 9, 1))]
    draws = [_sale_draw(1, "5", date(2026, 9, 5))]  # 2g costed, 3g pending
    grouped = {1: (lots, draws)}

    inside = cost_of_goods(grouped, date(2026, 9, 5), date(2026, 9, 5))
    outside = cost_of_goods(grouped, date(2026, 9, 6), date(2026, 9, 30))

    assert inside == CostOfGoods(200, True)
    assert outside == CostOfGoods(0, False)


def test_an_empty_business_gives_zero_and_no_pending() -> None:
    answer = cost_of_goods({}, date(2026, 9, 1), date(2026, 9, 30))

    assert answer == CostOfGoods(0, False)
