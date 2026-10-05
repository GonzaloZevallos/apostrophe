"""`DrawCosts`: results' one port for every draw, costed fresh (ADR-0009, ADR-0013).

One query for every stock entry and every sale-line draw of the business (each
already filtered on it, and `Draws` carries `variety_name`, `line_total` and
`pricing_rule` already attached to its row); `allocate` runs once per variety (the
plan's invariant: no other code multiplies grams by a cost or rounds a cost of
goods). `lots_and_draws` stays the one place a variety's lots and draws are
assembled, grouped and sorted (`lot_order.py`): its `draws` half is fed to `allocate`
exactly as it comes back, in its own order, never rebuilt or re-sorted here. The
display fields `lots_and_draws` has no room for — `kind`, `variety_name`, `sale_id`,
`line_total` — ride along in a side dict keyed by each draw's own `LotOrder`
(built with `lot_order.entry_order`/`sale_draw_order`, the same functions
`lots_and_draws` itself uses, so the key can never drift from its grouping), and are
looked up positionally by the already-ordered draw, never by joining a line to its
cost through `(sale_id, position)` afterwards (the plan's invariant: "nothing joins
sale lines to draw costs by key").

A sale-line draw becomes a `sold` or `gifted` row — `pricing_rule` is read here, so
stock's own domain stays unaware of gifts (ADR-0013's "considered and rejected": a
gift is never told by a $0 line total). A negative-adjustment entry becomes a
`shortfall` row, with no variety or sale attached. Built for one business.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.results.application.ports import DrawCosts
from app.results.domain.ledger import DrawKind, DrawRow
from app.sales.domain.pricing import PricingRule
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.lot_order import LotOrder, entry_order, lots_and_draws, sale_draw_order


@dataclass(frozen=True)
class _Meta:
    """The fields a `DrawRow` needs beyond what `lots_and_draws`' plain `Draw`
    carries, keyed onto it by `LotOrder` — never by `(sale_id, position)`."""

    kind: DrawKind
    variety_name: str | None
    sale_id: int | None
    line_total: int | None


class SqlDrawCosts(DrawCosts):
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)

    def rows(self) -> list[DrawRow]:
        entries = self._entries.for_varieties(None)
        sale_draws = self._draws.for_varieties(None)

        grouped = lots_and_draws(entries, sale_draws)

        meta_by_order: dict[LotOrder, _Meta] = {}
        for entry in entries:
            if entry.grams.is_positive:
                continue  # a lot, not a draw
            meta_by_order[entry_order(entry)] = _Meta(
                kind="shortfall", variety_name=None, sale_id=None, line_total=None
            )
        for sale_draw in sale_draws:
            kind: DrawKind = (
                "gifted" if sale_draw.pricing_rule == PricingRule.GIFT.value else "sold"
            )
            meta_by_order[sale_draw_order(sale_draw)] = _Meta(
                kind=kind,
                variety_name=sale_draw.variety_name,
                sale_id=sale_draw.sale_id,
                line_total=sale_draw.line_total,
            )

        rows: list[DrawRow] = []
        for variety_id, (lots, draws) in grouped.items():
            costs: list[DrawCost] = allocate(lots, draws)
            for draw, cost in zip(draws, costs, strict=True):
                meta = meta_by_order[draw.order]
                is_shortfall = meta.kind == "shortfall"
                rows.append(
                    DrawRow(
                        kind=meta.kind,
                        day=draw.order.day,
                        variety_id=None if is_shortfall else variety_id,
                        variety_name=None if is_shortfall else meta.variety_name,
                        sale_id=None if is_shortfall else meta.sale_id,
                        line_total=None if is_shortfall else meta.line_total,
                        grams=draw.grams,
                        costed=cost.costed,
                        pending=cost.pending,
                    )
                )
        return rows
