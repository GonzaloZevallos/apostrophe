"""`DrawCosts`: results' one port for every draw, costed fresh (ADR-0009, ADR-0013).

One query for every stock entry and every sale-line draw of the business (each
already filtered on it, and `Draws` carries `variety_name`, `line_total` and
`pricing_rule` already attached to its row); `allocate` runs once per variety (the
plan's invariant: no other code multiplies grams by a cost or rounds a cost of
goods). Each draw's row is built by sorting it into the exact `LotOrder` `allocate`
reads lots and draws in and then zipping, position for position, with `allocate`'s
own answer — never by joining a line to its cost through `(sale_id, position)`
afterwards (the plan's invariant: "nothing joins sale lines to draw costs by key").

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
from app.shared.grams import Grams
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.lot_order import (
    SALE_LINE_RANK,
    STOCK_ENTRY_RANK,
    Draw,
    Lot,
    LotOrder,
    lots_and_draws,
)


@dataclass(frozen=True)
class _RichDraw:
    """One draw, in its own `LotOrder`, carrying everything a `DrawRow` needs —
    built once here and never looked up again by key."""

    order: LotOrder
    kind: DrawKind
    variety_id: int
    variety_name: str | None
    sale_id: int | None
    line_total: int | None
    grams: Grams


class SqlDrawCosts(DrawCosts):
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)

    def rows(self) -> list[DrawRow]:
        entries = self._entries.for_varieties(None)
        sale_draws = self._draws.for_varieties(None)

        # `lots_and_draws` groups and sorts the lots for `allocate`; its own `draws`
        # half is not used here, since it would discard `variety_name`, `line_total`
        # and `pricing_rule` — rebuilt instead, below, in the identical `LotOrder`.
        grouped = lots_and_draws(entries, sale_draws)
        lots_by_variety = {variety_id: lots for variety_id, (lots, _) in grouped.items()}

        rich_by_variety: dict[int, list[_RichDraw]] = {}
        for entry in entries:
            if entry.grams.is_positive:
                continue  # a lot, not a draw
            assert entry.id is not None, "only a stored entry is ordered"
            order = LotOrder(entry.entry_date, entry.recorded_at, STOCK_ENTRY_RANK, entry.id, 0)
            rich_by_variety.setdefault(entry.variety_id, []).append(
                _RichDraw(
                    order=order,
                    kind="shortfall",
                    variety_id=entry.variety_id,
                    variety_name=None,
                    sale_id=None,
                    line_total=None,
                    grams=Grams(-entry.grams.hundredths),
                )
            )
        for draw in sale_draws:
            order = LotOrder(
                draw.day, draw.recorded_at, SALE_LINE_RANK, draw.sale_id, draw.position
            )
            kind: DrawKind = "gifted" if draw.pricing_rule == PricingRule.GIFT.value else "sold"
            rich_by_variety.setdefault(draw.variety_id, []).append(
                _RichDraw(
                    order=order,
                    kind=kind,
                    variety_id=draw.variety_id,
                    variety_name=draw.variety_name,
                    sale_id=draw.sale_id,
                    line_total=draw.line_total,
                    grams=draw.grams,
                )
            )

        rows: list[DrawRow] = []
        for variety_id, rich_list in rich_by_variety.items():
            rich_list.sort(key=lambda rich: rich.order)
            lots: list[Lot] = lots_by_variety.get(variety_id, [])
            plain_draws = [Draw(rich.order, variety_id, rich.grams) for rich in rich_list]
            costs: list[DrawCost] = allocate(lots, plain_draws)
            for rich, cost in zip(rich_list, costs, strict=True):
                is_shortfall = rich.kind == "shortfall"
                rows.append(
                    DrawRow(
                        kind=rich.kind,
                        day=rich.order.day,
                        variety_id=None if is_shortfall else rich.variety_id,
                        variety_name=None if is_shortfall else rich.variety_name,
                        sale_id=None if is_shortfall else rich.sale_id,
                        line_total=None if is_shortfall else rich.line_total,
                        grams=rich.grams,
                        costed=cost.costed,
                        pending=cost.pending,
                    )
                )
        return rows
