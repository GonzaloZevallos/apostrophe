"""`Purchases`: results' port for flower purchases and the earliest stock entry of
any origin (ADR-0020, CONTEXT.md: Purchase, First record). Built for one business.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.results.application.ports import PurchaseRecord
from app.stock.adapters.tables import StockEntryRow
from app.stock.domain.entry import Origin


class SqlPurchases:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def purchases(self) -> list[PurchaseRecord]:
        statement = select(StockEntryRow.entry_date, StockEntryRow.total_cost).where(
            StockEntryRow.business_id == self._business_id,
            StockEntryRow.origin == Origin.PURCHASE.value,
        )
        return [
            PurchaseRecord(day=day, total_cost=total_cost or 0)
            for day, total_cost in self._session.execute(statement).all()
        ]

    def earliest_entry_day(self) -> date | None:
        statement = select(func.min(StockEntryRow.entry_date)).where(
            StockEntryRow.business_id == self._business_id
        )
        return self._session.scalar(statement)
