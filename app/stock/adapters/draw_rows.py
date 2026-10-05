"""The one function that decides a draw's `kind` or calls `allocate` for results
(the plan's invariant; ADR-0009, ADR-0020, ADR-0013 amendment GH-70): both
`SqlDrawCosts.rows` (results' `DrawCosts` port, for `GET /analysis`) and
`SqlStockFigures.read` (results' `StockFigures` port, for `GET /panel`) call this over
their own `lots_and_draws` grouping, so neither repeats the decision or runs
`allocate` a second way.

`pricing_rule` is read here, so stock's own domain stays unaware of gifts (ADR-0020's
"considered and rejected": a gift is never told by a $0 line total). A draw with no
`sale_id` is a negative adjustment (a shortfall), never a sale line, told apart that
way with no variety or sale attached — never a join by `sale_id`, `position` or any
other key.
"""

from __future__ import annotations

from collections.abc import Mapping

from app.results.domain.ledger import DrawKind, DrawRow
from app.sales.domain.pricing import PricingRule
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.lot_order import Draw, Lot


def build_draw_rows(grouped: Mapping[int, tuple[list[Lot], list[Draw]]]) -> list[DrawRow]:
    """Runs `allocate` once per variety in `grouped` (its own full history, in its own
    order), then turns each `(draw, cost)` pair into one `DrawRow` — a sale line (sold
    or gifted) or a shortfall. Never rebuilds or re-sorts `draws` itself."""
    rows: list[DrawRow] = []
    for variety_id, (lots, draws) in grouped.items():
        costs: list[DrawCost] = allocate(lots, draws)
        for draw, cost in zip(draws, costs, strict=True):
            is_shortfall = draw.sale_id is None
            kind: DrawKind = (
                "shortfall"
                if is_shortfall
                else "gifted"
                if draw.pricing_rule == PricingRule.GIFT.value
                else "sold"
            )
            rows.append(
                DrawRow(
                    kind=kind,
                    day=draw.order.day,
                    variety_id=None if is_shortfall else variety_id,
                    variety_name=None if is_shortfall else draw.variety_name,
                    sale_id=None if is_shortfall else draw.sale_id,
                    line_total=None if is_shortfall else draw.line_total,
                    grams=draw.grams,
                    costed=cost.costed,
                    pending=cost.pending,
                )
            )
    return rows
