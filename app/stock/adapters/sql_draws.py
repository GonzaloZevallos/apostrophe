"""The `Draws` port over `sale_line ⨝ sale` (CODING_STANDARDS section 1: stock
adapters may import sales' adapters; nothing under `app/sales/` ever imports back).
Read only: a sale's own repository owns the write, this is stock reading what already
left (ADR-0009). Built for one business; every statement filters on it.
"""

from __future__ import annotations

from collections.abc import Collection

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.sales.adapters.tables import SaleLineRow, SaleRow
from app.shared.grams import Grams
from app.stock.domain.lot_order import SaleLineDraw


class SqlDraws:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[SaleLineDraw]:
        statement = (
            select(SaleLineRow, SaleRow)
            .join(SaleRow, SaleRow.id == SaleLineRow.sale_id)
            .where(SaleLineRow.business_id == self._business_id)
        )
        if variety_ids is not None:
            statement = statement.where(SaleLineRow.variety_id.in_(variety_ids))
        rows = self._session.execute(statement).all()
        return [
            SaleLineDraw(
                variety_id=line.variety_id,
                day=sale.sale_date,
                recorded_at=sale.recorded_at,
                sale_id=sale.id,
                position=line.position,
                grams=Grams(line.grams_hundredths),
            )
            for line, sale in rows
        ]
