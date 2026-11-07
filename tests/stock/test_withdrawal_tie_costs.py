"""A sale line and withdrawal lines on the same day and the same `recorded_at`, one of
them beyond every lot: the lots, costs and pending grams are literals, fixed before the
reason of a withdrawal became a list the business owns (ADR-0031: the reason never moves
a lot). Only `_withdrawal_line` knows how a withdrawal line names its reason."""

from __future__ import annotations

from datetime import date, datetime

from app.shared.quantity import Quantity
from app.stock.domain.allocation import allocate
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.lot_order import SaleLineDraw, WithdrawalLineDraw, lots_and_draws

DAY = date(2026, 9, 1)
AT = datetime(2026, 9, 1, 10, 0)


def _lot(entry_id: int, quantity: str, total_cost: int) -> StockEntry:
    return StockEntry.of(
        DAY,
        1,
        Origin.OPENING_STOCK,
        Quantity.of(quantity),
        total_cost,
        None,
        today=DAY,
        recorded_at=AT,
        id=entry_id,
    )


def _withdrawal_line(
    withdrawal_id: int, position: int, quantity: str, kind: int
) -> WithdrawalLineDraw:
    reason_id = 1 if kind == 0 else 2
    return WithdrawalLineDraw(
        variety_id=1,
        day=DAY,
        recorded_at=AT,
        withdrawal_id=withdrawal_id,
        position=position,
        quantity=Quantity.of(quantity),
        reason_id=reason_id,
    )


def test_a_tie_on_one_moment_costs_the_sale_then_each_withdrawal_line_by_position() -> None:
    lots_in = [_lot(1, "4", 400), _lot(2, "2", 600)]
    sale = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=7, position=0, quantity=Quantity.of("3")
    )
    lines = [
        _withdrawal_line(2, 0, "1", 1),
        _withdrawal_line(1, 1, "2", 1),
        _withdrawal_line(1, 0, "1", 0),
    ]

    lots, draws = lots_and_draws(lots_in, [sale], lines)[1]
    costs = allocate(lots, draws)

    # Lot 1 is 4 g at 400 (100 each), lot 2 is 2 g at 600 (300 each). Order: the sale
    # (3 g), withdrawal 1 line 0 (1 g), withdrawal 1 line 1 (2 g), withdrawal 2 line 0.
    assert [draw.quantity for draw in draws] == [
        Quantity.of("3"),
        Quantity.of("1"),
        Quantity.of("2"),
        Quantity.of("1"),
    ]
    assert [cost.costed for cost in costs] == [300, 100, 600, None]
    assert [cost.pending for cost in costs] == [
        Quantity.of("0"),
        Quantity.of("0"),
        Quantity.of("0"),
        Quantity.of("1"),
    ]
