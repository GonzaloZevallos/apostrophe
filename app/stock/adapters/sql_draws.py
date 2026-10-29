"""The `Draws` port over `sale_line ⨝ sale ⨝ variety` (CODING_STANDARDS section 1:
stock adapters may import sales' and varieties' adapters; nothing under `app/sales/`
or `app/products/` ever imports back). Read only: a sale's own repository owns the
write, this is stock reading what already left (ADR-0009). Built for one business;
every statement — and every join's ON clause — filters on it (CODING_STANDARDS
section 9).

`variety_name`, `line_total` and `pricing_rule` ride along on the same row (ADR-0020):
results' `DrawCosts` needs them attached to this exact draw, never looked up again by
`(sale_id, position)` afterwards.
"""

from __future__ import annotations

from collections.abc import Collection

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.products.adapters.tables import ProductRow
from app.sales.adapters.tables import SaleLineRow, SaleRow
from app.shared.quantity import Quantity
from app.stock.domain.lot_order import SaleLineDraw


class SqlDraws:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[SaleLineDraw]:
        statement = (
            select(SaleLineRow, SaleRow, ProductRow.name)
            .join(
                SaleRow,
                (SaleRow.id == SaleLineRow.sale_id) & (SaleRow.business_id == self._business_id),
            )
            .join(
                ProductRow,
                (ProductRow.id == SaleLineRow.variety_id)
                & (ProductRow.business_id == self._business_id),
            )
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
                quantity=Quantity(line.grams_hundredths),
                variety_name=variety_name,
                line_total=line.line_total,
                pricing_rule=line.pricing_rule,
            )
            for line, sale, variety_name in rows
        ]
