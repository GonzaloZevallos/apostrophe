"""`DrawCosts`: results' one port for every draw, costed fresh (ADR-0009, ADR-0020).

One query for every stock entry and every sale-line draw of the business (each
already filtered on it, and `Draws` carries `variety_name`, `line_total` and
`pricing_rule` already attached to its row); `allocate` runs once per variety (the
plan's invariant: no other code multiplies grams by a cost or rounds a cost of
goods). `lots_and_draws` stays the one place a variety's lots and draws are
assembled, grouped and sorted (`lot_order.py`): its `draws` half is fed to `allocate`
exactly as it comes back, in its own order, never rebuilt or re-sorted here.

The display fields a `DrawRow` needs beyond grams — `sale_id`, `line_total`,
`pricing_rule`, `variety_name` — ride along on the `Draw` itself: `lots_and_draws`
copies them straight off each `SaleLineDraw` when it builds that draw, so the exact
object `allocate` costs already carries them. Reading them back here, after `zip`ping
`draws` with `allocate`'s same-order `costs`, is never a join: nothing is looked up by
`sale_id`, `position` or any other key (the plan's invariant: "nothing joins sale
lines to draw costs by key") — a draw with no `sale_id` is simply a negative
adjustment, told apart that way, with no variety or sale attached.

`pricing_rule` is read here, so stock's own domain stays unaware of gifts (ADR-0020's
"considered and rejected": a gift is never told by a $0 line total). Built for one
business.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.results.application.ports import DrawCosts
from app.results.domain.ledger import DrawKind, DrawRow
from app.sales.domain.pricing import PricingRule
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.lot_order import lots_and_draws


class SqlDrawCosts(DrawCosts):
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)

    def rows(self) -> list[DrawRow]:
        entries = self._entries.for_varieties(None)
        sale_draws = self._draws.for_varieties(None)

        grouped = lots_and_draws(entries, sale_draws)

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
