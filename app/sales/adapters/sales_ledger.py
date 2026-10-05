"""`SalesLedger`: results' port for every sale, shipping included (ADR-0020). Built
for one business."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.results.application.ports import SaleRecord
from app.sales.adapters.tables import SaleLineRow, SaleRow


class SqlSalesLedger:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> list[SaleRecord]:
        line_totals = (
            select(
                SaleLineRow.sale_id.label("sale_id"),
                func.sum(SaleLineRow.line_total).label("lines_total"),
            )
            .where(SaleLineRow.business_id == self._business_id)
            .group_by(SaleLineRow.sale_id)
            .subquery()
        )
        statement = (
            select(
                SaleRow.id,
                SaleRow.sale_date,
                SaleRow.shipping_charged,
                func.coalesce(line_totals.c.lines_total, 0),
            )
            .select_from(SaleRow)
            .outerjoin(line_totals, line_totals.c.sale_id == SaleRow.id)
            .where(SaleRow.business_id == self._business_id)
        )
        return [
            SaleRecord(sale_id=sale_id, day=day, shipping=shipping, total=shipping + lines_total)
            for sale_id, day, shipping, lines_total in self._session.execute(statement).all()
        ]
