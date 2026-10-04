"""`DrawCosts`: results' one port for every draw, costed fresh (ADR-0009, ADR-0013).

One query for every stock entry and every sale-line draw of the business (each
already filtered on it); `lots_and_draws` groups them by variety and `allocate` runs
once per variety (the plan's invariant: no other code multiplies grams by a cost or
rounds a cost of goods). A sale-line draw becomes a `sold` or `gifted` row —
`pricing_rule` is read here, so stock's own domain stays unaware of gifts
(ADR-0013's "considered and rejected": a gift is never told by a $0 line total). A
negative-adjustment entry becomes a `shortfall` row, with no variety or sale
attached. Built for one business.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.results.application.ports import DrawCosts
from app.results.domain.ledger import DrawKind, DrawRow
from app.sales.adapters.tables import SaleLineRow
from app.sales.domain.pricing import PricingRule
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.domain.allocation import allocate
from app.stock.domain.lot_order import SALE_LINE_RANK, lots_and_draws
from app.varieties.adapters.tables import VarietyRow


class SqlDrawCosts(DrawCosts):
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)

    def rows(self) -> list[DrawRow]:
        entries = self._entries.for_varieties(None)
        sale_draws = self._draws.for_varieties(None)
        grouped = lots_and_draws(entries, sale_draws)

        line_info = self._line_info()
        variety_names = self._variety_names()

        rows: list[DrawRow] = []
        for variety_id, (lots, draws) in grouped.items():
            for draw, cost in zip(draws, allocate(lots, draws), strict=True):
                if draw.order.rank == SALE_LINE_RANK:
                    sale_id = draw.order.ref_id
                    position = draw.order.position
                    pricing_rule, line_total = line_info[(sale_id, position)]
                    kind: DrawKind = "gifted" if pricing_rule == PricingRule.GIFT else "sold"
                    rows.append(
                        DrawRow(
                            kind=kind,
                            day=draw.order.day,
                            variety_id=variety_id,
                            variety_name=variety_names.get(variety_id, ""),
                            sale_id=sale_id,
                            line_total=line_total,
                            grams=draw.grams,
                            costed=cost.costed,
                            pending=cost.pending,
                        )
                    )
                else:
                    rows.append(
                        DrawRow(
                            kind="shortfall",
                            day=draw.order.day,
                            variety_id=None,
                            variety_name=None,
                            sale_id=None,
                            line_total=None,
                            grams=draw.grams,
                            costed=cost.costed,
                            pending=cost.pending,
                        )
                    )
        return rows

    def _line_info(self) -> dict[tuple[int, int], tuple[PricingRule, int]]:
        statement = select(
            SaleLineRow.sale_id,
            SaleLineRow.position,
            SaleLineRow.pricing_rule,
            SaleLineRow.line_total,
        ).where(SaleLineRow.business_id == self._business_id)
        return {
            (sale_id, position): (PricingRule(rule), line_total)
            for sale_id, position, rule, line_total in self._session.execute(statement).all()
        }

    def _variety_names(self) -> dict[int, str]:
        statement = select(VarietyRow.id, VarietyRow.name).where(
            VarietyRow.business_id == self._business_id
        )
        return dict(self._session.execute(statement).all())
