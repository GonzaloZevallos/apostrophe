"""`build_draw_rows` at its seam (ADR-0030): each draw source maps to its own kind,
told by `Draw.source` alone, never by a missing sale id or a $0 line total."""

from __future__ import annotations

from datetime import date, datetime

from app.sales.domain.pricing import PricingRule
from app.shared.grams import Grams
from app.stock.adapters.draw_rows import build_draw_rows
from app.stock.domain.draw_source import DrawSource
from app.stock.domain.lot_order import (
    SALE_LINE_RANK,
    STOCK_ENTRY_RANK,
    WITHDRAWAL_LINE_RANK,
    Draw,
    Lot,
    LotOrder,
)

DAY = date(2026, 10, 3)
NOW = datetime(2026, 10, 3, 12, 0)
VARIETY = 7


def _lot(grams: str, cost: int) -> Lot:
    order = LotOrder(date(2026, 10, 1), NOW, STOCK_ENTRY_RANK, 1, 0)
    return Lot(order, VARIETY, Grams.of(grams), cost)


def _withdrawal(source: DrawSource, grams: str) -> Draw:
    return Draw(LotOrder(DAY, NOW, WITHDRAWAL_LINE_RANK, 1, 0), VARIETY, Grams.of(grams), source)


def _sale_line(rule: PricingRule, line_total: int) -> Draw:
    return Draw(
        LotOrder(DAY, NOW, SALE_LINE_RANK, 5, 0),
        VARIETY,
        Grams.of("2"),
        DrawSource.SALE_LINE,
        sale_id=5,
        line_total=line_total,
        pricing_rule=rule.value,
        variety_name="Flor",
    )


def test_a_list_priced_sale_line_is_sold_and_a_gift_is_gifted() -> None:
    sold = _sale_line(PricingRule.LIST, 4_000)
    gift = _sale_line(PricingRule.GIFT, 0)

    [sold_row] = build_draw_rows({VARIETY: ([_lot("10", 10_000)], [sold])})
    [gift_row] = build_draw_rows({VARIETY: ([_lot("10", 10_000)], [gift])})

    assert sold_row.kind == "sold"
    assert (sold_row.variety_id, sold_row.sale_id, sold_row.line_total) == (VARIETY, 5, 4_000)
    assert gift_row.kind == "gifted"
    assert gift_row.line_total == 0


def test_a_negative_adjustment_is_a_shortfall_with_no_variety_sale_or_total() -> None:
    adjustment = Draw(
        LotOrder(DAY, NOW, STOCK_ENTRY_RANK, 2, 0), VARIETY, Grams.of("2"), DrawSource.ADJUSTMENT
    )

    [row] = build_draw_rows({VARIETY: ([_lot("10", 10_000)], [adjustment])})

    assert row.kind == "shortfall"
    assert (row.variety_id, row.variety_name, row.sale_id, row.line_total) == (
        None,
        None,
        None,
        None,
    )
    assert row.costed == 2_000


def test_a_withdrawal_line_is_its_reason_s_kind_with_no_variety_sale_or_total() -> None:
    promotion = _withdrawal(DrawSource.PROMOTION, "2")
    own_use = _withdrawal(DrawSource.OWN_USE, "3")

    [promotion_row] = build_draw_rows({VARIETY: ([_lot("10", 10_000)], [promotion])})
    [own_use_row] = build_draw_rows({VARIETY: ([_lot("10", 10_000)], [own_use])})

    assert promotion_row.kind == "promotion"
    assert promotion_row.costed == 2_000
    assert own_use_row.kind == "own_use"
    assert own_use_row.costed == 3_000
    for row in (promotion_row, own_use_row):
        assert (row.variety_id, row.variety_name, row.sale_id, row.line_total) == (
            None,
            None,
            None,
            None,
        )


def test_a_withdrawal_past_every_lot_is_pending_never_costed_zero() -> None:
    draw = _withdrawal(DrawSource.OWN_USE, "5")

    [row] = build_draw_rows({VARIETY: ([_lot("3", 3_000)], [draw])})

    assert row.costed == 3_000
    assert row.pending == Grams.of("2")
