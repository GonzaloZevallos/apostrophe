"""`stock_level`: a variety's grams, status, sold-out-since date and days left, with no
infrastructure (CONTEXT.md: Stock, Stock status, Days left; ADR-0009; PM round-1
clarification on status order)."""

from __future__ import annotations

from datetime import date, datetime

from app.shared.grams import Grams
from app.stock.domain.lot_order import Draw, Lot, LotOrder
from app.stock.domain.stock_level import stock_level
from app.stock.domain.threshold import Threshold

AT = datetime(2026, 9, 1, 10, 0)
TODAY = date(2026, 10, 2)


def _lot(grams: str, day: date, ref_id: int = 1) -> Lot:
    return Lot(LotOrder(day, AT, 0, ref_id, 0), 1, Grams.of(grams), None)


def _draw(grams: str, day: date, ref_id: int = 1, rank: int = 1) -> Draw:
    return Draw(LotOrder(day, AT, rank, ref_id, 0), 1, Grams.of(grams))


def test_no_entries_when_nothing_has_ever_moved() -> None:
    level = stock_level([], [], None, TODAY)

    assert level.status == "no_entries"
    assert level.grams == Grams(0)
    assert level.sold_out_since is None
    assert level.days_left is None


def test_ok_when_stock_is_above_the_threshold() -> None:
    level = stock_level([_lot("50", TODAY)], [], Threshold.of(Grams.of("20")), TODAY)

    assert level.status == "ok"
    assert level.grams == Grams.of("50")


def test_low_when_stock_is_under_the_threshold() -> None:
    level = stock_level([_lot("10", TODAY)], [], Threshold.of(Grams.of("20")), TODAY)

    assert level.status == "low"


def test_ok_with_no_threshold_even_at_a_low_level() -> None:
    level = stock_level([_lot("1", TODAY)], [], None, TODAY)

    assert level.status == "ok"


def test_sold_out_when_stock_reaches_exactly_zero() -> None:
    level = stock_level(
        [_lot("10", date(2026, 9, 1))], [_draw("10", date(2026, 9, 2))], None, TODAY
    )

    assert level.status == "sold_out"
    assert level.grams == Grams(0)
    assert level.sold_out_since == date(2026, 9, 2)


def test_sold_out_wins_over_a_threshold() -> None:
    level = stock_level(
        [_lot("10", date(2026, 9, 1))],
        [_draw("12", date(2026, 9, 2))],
        Threshold.of(Grams.of("50")),
        TODAY,
    )

    assert level.status == "sold_out"


def test_sales_with_no_entries_still_reads_sold_out() -> None:
    """PM round-1 clarification: a variety with sales or gifts but no stock entry is
    sold out, not 'no entries' — its negative figure shows next to it."""
    level = stock_level([], [_draw("4", date(2026, 9, 5))], None, TODAY)

    assert level.status == "sold_out"
    assert level.grams == Grams.of("-4")
    assert level.sold_out_since == date(2026, 9, 5)


def test_entries_that_net_to_zero_read_sold_out_not_no_entries() -> None:
    level = stock_level(
        [_lot("10", date(2026, 9, 1))], [_draw("10", date(2026, 9, 1))], None, TODAY
    )

    assert level.status == "sold_out"


def test_sold_out_since_is_the_earliest_day_the_balance_has_stayed_at_or_below_zero() -> None:
    level = stock_level(
        [_lot("10", date(2026, 9, 1))],
        [_draw("6", date(2026, 9, 2)), _draw("6", date(2026, 9, 3))],
        None,
        TODAY,
    )

    # Day 1: +10 (10). Day 2: -6 (4, still above zero). Day 3: -6 (-2): sold out since
    # day 3 only — day 2's balance was still positive.
    assert level.sold_out_since == date(2026, 9, 3)


def test_a_late_entry_recovers_the_variety_and_clears_sold_out_since() -> None:
    level = stock_level(
        [_lot("10", date(2026, 9, 1)), _lot("10", date(2026, 9, 10))],
        [_draw("10", date(2026, 9, 2))],
        None,
        TODAY,
    )

    assert level.status == "ok"
    assert level.sold_out_since is None


def test_days_left_divides_stock_by_the_30_day_pace() -> None:
    draws = [_draw("30", TODAY)]
    level = stock_level([_lot("60", date(2026, 9, 1))], draws, None, TODAY)

    assert level.days_left == 30


def test_days_left_excludes_sale_draws_outside_the_30_day_window() -> None:
    old = _draw("30", date(2026, 8, 1), ref_id=1)  # well past 30 days before TODAY
    recent = _draw("10", TODAY, ref_id=2)
    level = stock_level([_lot("100", date(2026, 1, 1))], [old, recent], None, TODAY)

    # Stock is 100 - 30 - 10 = 60; only the recent 10g paces it: 60 * 30 // 10 = 180.
    assert level.days_left == 180


def test_days_left_excludes_negative_adjustments_from_the_pace() -> None:
    adjustment = _draw("10", TODAY, rank=0)  # rank 0: a stock-entry draw, not a sale line
    level = stock_level([_lot("100", date(2026, 9, 1))], [adjustment], None, TODAY)

    assert level.days_left is None


def test_days_left_is_none_when_stock_is_at_or_below_zero() -> None:
    level = stock_level(
        [_lot("10", date(2026, 9, 1))], [_draw("12", TODAY)], None, TODAY
    )

    assert level.days_left is None


def test_days_left_is_none_with_nothing_out_in_the_last_30_days() -> None:
    level = stock_level([_lot("10", date(2026, 1, 1))], [], None, TODAY)

    assert level.days_left is None
