"""The one function that decides a draw's `kind` or calls `allocate` for results
(the plan's invariant; ADR-0009, ADR-0020, ADR-0013 amendment GH-70): both
`SqlDrawCosts.rows` (results' `DrawCosts` port, for `GET /analysis`) and
`SqlStockFigures.read` (results' `StockFigures` port, for `GET /panel`) call this over
their own `lots_and_draws` grouping, so neither repeats the decision or runs
`allocate` a second way.

`pricing_rule` is read here, so stock's own domain stays unaware of gifts (ADR-0020's
"considered and rejected": a gift is never told by a $0 line total). A draw's kind is
decided only from `Draw.source` (ADR-0031), never from a missing `sale_id`, pricing
rule or line total; an adjustment and a withdrawal carry no variety or sale — never a
join by `sale_id`, `position` or any other key.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import assert_never

from app.results.domain.ledger import DrawKind, DrawRow
from app.sales.domain.pricing import PricingRule
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.draw_source import DrawSource
from app.stock.domain.lot_order import Draw, Lot


def _row_of(variety_id: int, draw: Draw, cost: DrawCost) -> DrawRow:
    """One `(draw, cost)` pair as a `DrawRow`, its kind told by `draw.source` alone: a
    shortfall or a withdrawal carries no variety, sale or line total."""
    kind: DrawKind
    match draw.source:
        case DrawSource.SALE_LINE:
            kind = "gifted" if draw.pricing_rule == PricingRule.GIFT.value else "sold"
            return DrawRow(
                kind=kind,
                day=draw.order.day,
                variety_id=variety_id,
                variety_name=draw.variety_name,
                sale_id=draw.sale_id,
                line_total=draw.line_total,
                quantity=draw.quantity,
                costed=cost.costed,
                pending=cost.pending,
            )
        case DrawSource.ADJUSTMENT:
            kind = "shortfall"
        case DrawSource.PROMOTION:
            kind = "promotion"
        case DrawSource.OWN_USE:
            kind = "own_use"
        case _:
            assert_never(draw.source)
    return DrawRow(
        kind=kind,
        day=draw.order.day,
        variety_id=None,
        variety_name=None,
        sale_id=None,
        line_total=None,
        quantity=draw.quantity,
        costed=cost.costed,
        pending=cost.pending,
    )


def build_draw_rows(grouped: Mapping[int, tuple[list[Lot], list[Draw]]]) -> list[DrawRow]:
    """Runs `allocate` once per variety in `grouped` (its own full history, in its own
    order), then turns each `(draw, cost)` pair into one `DrawRow` — a sale line (sold
    or gifted), a shortfall, a promotion or an own use. Never rebuilds or re-sorts
    `draws` itself."""
    rows: list[DrawRow] = []
    for variety_id, (lots, draws) in grouped.items():
        costs: list[DrawCost] = allocate(lots, draws)
        for draw, cost in zip(draws, costs, strict=True):
            rows.append(_row_of(variety_id, draw, cost))
    return rows
