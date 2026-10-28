"""`lots_and_draws`: grouping and ordering entries and sale-line draws by variety, with
no infrastructure (CONTEXT.md: Lot, Draw, Lot order; ADR-0009)."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from app.shared.quantity import Quantity
from app.stock.domain.allocation import allocate
from app.stock.domain.draw_source import DrawSource, WithdrawalReason
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.lot_order import (
    WITHDRAWAL_LINE_RANK,
    Draw,
    Lot,
    LotOrder,
    SaleLineDraw,
    WithdrawalLineDraw,
    lots_and_draws,
)

DAY = date(2026, 9, 1)
LATER = date(2026, 9, 10)
AT = datetime(2026, 9, 1, 10, 0)
LATER_AT = datetime(2026, 9, 10, 10, 0)


def _entry(
    *,
    id: int,
    variety_id: int = 1,
    quantity: str = "10",
    origin: Origin = Origin.OPENING_STOCK,
    entry_date: date = DAY,
    recorded_at: datetime = AT,
    total_cost: int | None = None,
) -> StockEntry:
    return StockEntry.of(
        entry_date,
        variety_id,
        origin,
        Quantity.of(quantity),
        total_cost,
        None,
        today=LATER,
        recorded_at=recorded_at,
        id=id,
    )


def test_a_positive_entry_is_a_lot() -> None:
    grouped = lots_and_draws([_entry(id=1, grams="10")], [], [])

    lots, draws = grouped[1]
    assert len(lots) == 1
    assert lots[0].quantity == Quantity.of("10")
    assert draws == []


def test_a_negative_adjustment_is_a_draw_carried_as_a_positive_magnitude() -> None:
    grouped = lots_and_draws(
        [_entry(id=1, grams="-4", origin=Origin.ADJUSTMENT)], [], []
    )

    lots, draws = grouped[1]
    assert lots == []
    assert len(draws) == 1
    assert draws[0].quantity == Quantity.of("4")


def test_a_sale_line_is_always_a_draw_gifts_included() -> None:
    sale_draw = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=5, position=0, quantity=Quantity.of("3")
    )

    grouped = lots_and_draws([], [sale_draw], [])

    lots, draws = grouped[1]
    assert lots == []
    assert len(draws) == 1
    assert draws[0].quantity == Quantity.of("3")


def test_varieties_are_grouped_separately() -> None:
    grouped = lots_and_draws(
        [_entry(id=1, variety_id=1, grams="10"), _entry(id=2, variety_id=2, grams="20")], [], []
    )

    assert set(grouped) == {1, 2}
    assert grouped[1][0][0].quantity == Quantity.of("10")
    assert grouped[2][0][0].quantity == Quantity.of("20")


def test_a_group_is_sorted_by_date_first() -> None:
    later = _entry(id=1, grams="10", entry_date=LATER, recorded_at=AT)
    earlier = _entry(id=2, grams="5", entry_date=DAY, recorded_at=LATER_AT)

    lots, _ = lots_and_draws([later, earlier], [], [])[1]

    assert [lot.order.ref_id for lot in lots] == [2, 1]


def test_same_day_breaks_the_tie_by_recorded_order() -> None:
    recorded_second = _entry(id=1, grams="10", recorded_at=LATER_AT)
    recorded_first = _entry(id=2, grams="5", recorded_at=AT)

    lots, _ = lots_and_draws([recorded_second, recorded_first], [], [])[1]

    assert [lot.order.ref_id for lot in lots] == [2, 1]


def test_a_variety_with_nothing_is_simply_absent() -> None:
    grouped = lots_and_draws([_entry(id=1, variety_id=1)], [], [])

    assert 2 not in grouped


def test_draws_are_sorted_too_oldest_first() -> None:
    later_adjustment = _entry(
        id=1, grams="-10", origin=Origin.ADJUSTMENT, entry_date=LATER, recorded_at=LATER_AT
    )
    earlier_sale = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=5, position=0, quantity=Quantity.of("3")
    )

    _, draws = lots_and_draws([later_adjustment], [earlier_sale], [])[1]

    assert [draw.order.day for draw in draws] == [DAY, LATER]


def test_a_negative_adjustment_and_a_sale_line_on_the_same_moment_break_the_tie_by_rank() -> None:
    """Draw order decides which draw takes which lot's cost: a stock-entry draw and a
    sale-line draw on the exact same day and the exact same recorded moment must still
    resolve the same way every time, by `rank` (stock entry first, sale line second) —
    never by `ref_id` or insertion order. The adjustment's `ref_id` (9) is deliberately
    larger than the sale's (1), and `lots_and_draws` always appends entry-draws before
    sale draws internally, so a `LotOrder` that dropped `rank` and fell back to
    `ref_id` — or to the stable sort's insertion order — would read this backwards."""
    adjustment = _entry(id=9, grams="-2", origin=Origin.ADJUSTMENT, entry_date=DAY, recorded_at=AT)
    sale_draw = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=1, position=0, quantity=Quantity.of("3")
    )

    _, draws = lots_and_draws([adjustment], [sale_draw], [])[1]

    assert [draw.order.rank for draw in draws] == [0, 1]
    assert [draw.source for draw in draws] == [DrawSource.ADJUSTMENT, DrawSource.SALE_LINE]
    assert draws[0].quantity == Quantity.of("2")
    assert draws[1].quantity == Quantity.of("3")


def _withdrawal_line(
    withdrawal_id: int,
    position: int,
    quantity: str,
    reason: WithdrawalReason = WithdrawalReason.PROMOTION,
) -> WithdrawalLineDraw:
    return WithdrawalLineDraw(
        variety_id=1,
        day=DAY,
        recorded_at=AT,
        withdrawal_id=withdrawal_id,
        position=position,
        quantity=Quantity.of(quantity),
        reason=reason,
    )


def test_an_exact_tie_orders_adjustment_then_sale_line_then_withdrawal_lines_by_position() -> None:
    """The withdrawal's id (1) is smaller than the adjustment's (9) and its lines are
    handed in reversed, so only `rank` then `position` can produce this order."""
    lot = _entry(id=5, grams="3", total_cost=300)
    adjustment = _entry(id=9, grams="-1", origin=Origin.ADJUSTMENT)
    sale_draw = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=7, position=0, quantity=Quantity.of("1")
    )
    second_line = _withdrawal_line(1, 1, "1", WithdrawalReason.OWN_USE)
    first_line = _withdrawal_line(1, 0, "1", WithdrawalReason.PROMOTION)

    lots, draws = lots_and_draws([adjustment, lot], [sale_draw], [second_line, first_line])[1]

    assert [draw.source for draw in draws] == [
        DrawSource.ADJUSTMENT,
        DrawSource.SALE_LINE,
        DrawSource.PROMOTION,
        DrawSource.OWN_USE,
    ]
    assert [draw.order.rank for draw in draws] == [0, 1, WITHDRAWAL_LINE_RANK, WITHDRAWAL_LINE_RANK]
    assert WITHDRAWAL_LINE_RANK == 2
    assert [draw.order.position for draw in draws[2:]] == [0, 1]
    assert [draw.order.ref_id for draw in draws[2:]] == [1, 1]
    # The lot holds 3 g at 100 each and the adjustment draws first: the own-use line,
    # last in the order, is the one that finds the lot spent and is wholly pending.
    costs = allocate(lots, draws)
    assert [cost.costed for cost in costs] == [100, 100, 100, None]
    assert [cost.pending for cost in costs] == [
        Quantity.of("0"),
        Quantity.of("0"),
        Quantity.of("0"),
        Quantity.of("1"),
    ]


def test_a_withdrawal_line_past_every_lot_is_pending_never_costed_zero() -> None:
    lot = _entry(id=1, grams="2", total_cost=200)
    line = _withdrawal_line(1, 0, "5")

    lots, draws = lots_and_draws([lot], [], [line])[1]
    [cost] = allocate(lots, draws)

    assert cost.costed == 200
    assert cost.pending == Quantity.of("3")


def test_total_pending_equals_negative_stock_with_a_withdrawal_involved() -> None:
    lot = _entry(id=1, grams="4", total_cost=400)
    sale_draw = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=7, position=0, quantity=Quantity.of("3")
    )
    line = _withdrawal_line(1, 0, "5", WithdrawalReason.OWN_USE)

    lots, draws = lots_and_draws([lot], [sale_draw], [line])[1]
    pending = sum(cost.pending.hundredths for cost in allocate(lots, draws))

    stock = sum(lot.quantity.hundredths for lot in lots) - sum(d.quantity.hundredths for d in draws)
    assert pending == max(0, -stock) == 400


def test_a_withdrawal_draw_carries_no_sale_data() -> None:
    _, draws = lots_and_draws([], [], [_withdrawal_line(3, 0, "2")])[1]

    [draw] = draws
    assert draw.source is DrawSource.PROMOTION
    assert (draw.sale_id, draw.line_total, draw.pricing_rule, draw.variety_name) == (
        None,
        None,
        None,
        None,
    )
    assert draw.order == LotOrder(DAY, AT, WITHDRAWAL_LINE_RANK, 3, 0)


# -- Lot and Draw: value objects validated in __post_init__, like Threshold ------------


def test_a_lot_refuses_non_positive_grams() -> None:
    order = LotOrder(DAY, AT, 0, 1, 0)
    with pytest.raises(ValueError):
        Lot(order, 1, Quantity.of("0"), None)


def test_a_draw_refuses_non_positive_grams() -> None:
    order = LotOrder(DAY, AT, 1, 1, 0)
    with pytest.raises(ValueError):
        Draw(order, 1, Quantity.of("-1"), DrawSource.SALE_LINE)
