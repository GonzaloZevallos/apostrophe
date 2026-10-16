"""`row_cost` and the grams behind each cost line, with no infrastructure
(CODING_STANDARDS §5, ADR-0020): the one place that decides a cost figure is fully
pending, and the rows of `period_figures` that carry it."""

from datetime import date, timedelta
from typing import Literal

import pytest

from app.results.domain.figures import RowCost
from app.results.domain.ledger import DrawRow, SaleRecord
from app.results.domain.period_figures import (
    Buckets,
    period_figures,
    row_cost,
    scan,
    totals_between,
)
from app.shared.calendar import Month
from app.shared.grams import Grams

TODAY = date(2026, 10, 4)  # a Sunday
YESTERDAY = TODAY - timedelta(days=1)

Reason = Literal["shortfall", "promotion", "own_use", "cost_of_goods"]
REASONS: tuple[Reason, ...] = ("shortfall", "promotion", "own_use", "cost_of_goods")


def _g(value: str) -> Grams:
    return Grams.of(value)


def _draw(reason: Reason, day: date, *, grams: str, costed: int | None, pending: str) -> DrawRow:
    if reason == "cost_of_goods":
        return DrawRow(
            kind="sold",
            day=day,
            variety_id=1,
            variety_name="Flor",
            sale_id=1,
            line_total=1_000,
            grams=_g(grams),
            costed=costed,
            pending=_g(pending),
        )
    return DrawRow(
        kind=reason,
        day=day,
        variety_id=None,
        variety_name=None,
        sale_id=None,
        line_total=None,
        grams=_g(grams),
        costed=costed,
        pending=_g(pending),
    )


def _scan(draws: list[DrawRow]) -> Buckets:
    buckets, _ = scan(
        draws=draws,
        sales=[SaleRecord(1, TODAY, 0, 1_000)] if any(d.kind == "sold" for d in draws) else [],
        payments=[],
        expenses=[],
        purchases=[],
        earliest_entry_day=YESTERDAY,
    )
    return buckets


def _line(reason: Reason, draws: list[DrawRow], start: date, end: date) -> RowCost | None:
    totals = totals_between(_scan(draws), start, end)
    match reason:
        case "shortfall":
            return totals.shortfall
        case "promotion":
            return totals.promotion
        case "own_use":
            return totals.own_use
        case "cost_of_goods":
            return totals.cost_of_goods_row


# --- row_cost ---


def test_row_cost_with_no_grams_is_never_fully_pending() -> None:
    assert row_cost(0, _g("0"), _g("0")) == RowCost(0, _g("0"), False)


def test_row_cost_partly_pending_is_not_fully_pending() -> None:
    assert row_cost(500, _g("1"), _g("2")) == RowCost(500, _g("1"), False)


def test_row_cost_with_every_gram_pending_is_fully_pending() -> None:
    assert row_cost(0, _g("4"), _g("4")) == RowCost(0, _g("4"), True)


def test_row_cost_costed_at_zero_with_some_pending_is_not_fully_pending() -> None:
    # A harvest or opening-stock lot costs $0: "costed == 0" is not "all pending".
    assert row_cost(0, _g("1"), _g("3")) == RowCost(0, _g("1"), False)


def test_row_cost_with_every_gram_costed_at_zero_is_not_fully_pending() -> None:
    assert row_cost(0, _g("0"), _g("3")) == RowCost(0, _g("0"), False)


def test_a_row_cost_flagged_fully_pending_without_pending_grams_is_rejected() -> None:
    with pytest.raises(ValueError, match="fully pending"):
        RowCost(0, _g("0"), True)


def test_a_row_cost_with_a_negative_amount_or_pending_is_rejected() -> None:
    with pytest.raises(ValueError, match="amount"):
        RowCost(-1, _g("0"), False)
    with pytest.raises(ValueError, match="pending"):
        RowCost(0, _g("-1"), False)


# --- through scan + totals_between, for every cost line ---


@pytest.mark.parametrize("reason", REASONS)
def test_one_fully_pending_draw_is_fully_pending(reason: Reason) -> None:
    draws = [_draw(reason, TODAY, grams="4", costed=None, pending="4")]

    assert _line(reason, draws, TODAY, TODAY) == RowCost(0, _g("4"), True)


@pytest.mark.parametrize("reason", REASONS)
def test_a_half_costed_draw_is_not_fully_pending(reason: Reason) -> None:
    draws = [_draw(reason, TODAY, grams="4", costed=300, pending="2")]

    assert _line(reason, draws, TODAY, TODAY) == RowCost(300, _g("2"), False)


@pytest.mark.parametrize("reason", REASONS)
def test_a_pending_day_and_a_costed_day_over_one_range_are_not_fully_pending(
    reason: Reason,
) -> None:
    draws = [
        _draw(reason, YESTERDAY, grams="4", costed=None, pending="4"),
        _draw(reason, TODAY, grams="2", costed=200, pending="0"),
    ]

    assert _line(reason, draws, YESTERDAY, TODAY) == RowCost(200, _g("4"), False)
    assert _line(reason, draws, YESTERDAY, YESTERDAY) == RowCost(0, _g("4"), True)


@pytest.mark.parametrize("reason", REASONS)
def test_two_fully_pending_days_over_one_range_are_fully_pending(reason: Reason) -> None:
    draws = [
        _draw(reason, YESTERDAY, grams="4", costed=None, pending="4"),
        _draw(reason, TODAY, grams="2", costed=None, pending="2"),
    ]

    assert _line(reason, draws, YESTERDAY, TODAY) == RowCost(0, _g("6"), True)


@pytest.mark.parametrize("reason", ["shortfall", "promotion", "own_use"])
def test_a_period_without_that_draw_has_no_line(reason: Reason) -> None:
    draws = [_draw(reason, YESTERDAY, grams="1", costed=100, pending="0")]

    assert _line(reason, draws, TODAY, TODAY) is None


def test_a_period_with_no_sales_has_a_zero_cost_of_goods_that_is_not_pending() -> None:
    assert _line("cost_of_goods", [], TODAY, TODAY) == RowCost(0, _g("0"), False)


def test_cost_of_goods_counts_sold_and_gifted_grams_only() -> None:
    sold = _draw("cost_of_goods", TODAY, grams="3", costed=None, pending="3")
    shortfall = _draw("shortfall", TODAY, grams="5", costed=None, pending="5")
    promotion = _draw("promotion", TODAY, grams="7", costed=None, pending="7")

    cost = _line("cost_of_goods", [sold, shortfall, promotion], TODAY, TODAY)

    assert cost == RowCost(0, _g("3"), True)


def test_cost_of_goods_row_keeps_the_panel_figure_unchanged() -> None:
    draws = [_draw("cost_of_goods", TODAY, grams="4", costed=300, pending="1")]

    totals = totals_between(_scan(draws), TODAY, TODAY)

    assert totals.cost_of_goods.costed == totals.cost_of_goods_row.amount == 300
    assert totals.cost_of_goods.pending_grams == totals.cost_of_goods_row.pending_grams


# --- through period_figures: rows, header and since-the-first-record ---


def test_every_row_the_header_and_since_carry_the_same_row_cost_as_totals_between() -> None:
    draws = [
        _draw("cost_of_goods", TODAY, grams="4", costed=None, pending="4"),
        _draw("shortfall", TODAY, grams="2", costed=None, pending="2"),
        _draw("promotion", TODAY, grams="1", costed=None, pending="1"),
        _draw("own_use", TODAY, grams="3", costed=90, pending="1"),
    ]
    month = Month.containing(TODAY)

    figures = period_figures(
        today=TODAY,
        month=month,
        draws=draws,
        sales=[SaleRecord(1, TODAY, 0, 1_000)],
        payments=[],
        expenses=[],
        purchases=[],
        earliest_entry_day=TODAY,
    )

    week = figures.weeks[-1]
    month_row = figures.months[-1]
    assert week.cost_of_goods == RowCost(0, _g("4"), True)
    assert week.shortfall == RowCost(0, _g("2"), True)
    assert week.promotion == RowCost(0, _g("1"), True)
    assert week.own_use == RowCost(90, _g("1"), False)
    assert month_row.cost_of_goods == week.cost_of_goods
    assert month_row.shortfall == week.shortfall
    assert figures.month.shortfall == week.shortfall
    assert figures.month.promotion == week.promotion
    assert figures.month.own_use == week.own_use
    assert figures.since_first_record is not None
    assert figures.since_first_record.shortfall == week.shortfall
    assert figures.since_first_record.promotion == week.promotion
    assert figures.since_first_record.own_use == week.own_use


def test_a_week_without_a_shortfall_has_none_and_a_real_zero_cost_of_goods() -> None:
    draws = [_draw("promotion", YESTERDAY, grams="1", costed=100, pending="0")]

    figures = period_figures(
        today=TODAY,
        month=Month.containing(TODAY),
        draws=draws,
        sales=[],
        payments=[],
        expenses=[],
        purchases=[],
        earliest_entry_day=YESTERDAY,
    )

    week = figures.weeks[-1]
    assert week.shortfall is None
    assert week.cost_of_goods == RowCost(0, _g("0"), False)


def test_profit_keeps_summing_the_pending_grams_of_every_line() -> None:
    draws = [
        _draw("cost_of_goods", TODAY, grams="4", costed=None, pending="4"),
        _draw("shortfall", TODAY, grams="2", costed=None, pending="2"),
        _draw("promotion", TODAY, grams="1", costed=None, pending="1"),
    ]

    totals = totals_between(_scan(draws), TODAY, TODAY)

    assert totals.profit.pending_grams == _g("7")
