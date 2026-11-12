"""`Purchases`: results' port for flower purchases and the earliest stock entry of
any origin (ADR-0020, CONTEXT.md: Purchase, First record). Built for one business.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import domain_amount, money_scale_factor, scaled
from app.results.application.ports import PurchaseRecord
from app.stock.adapters.tables import StockEntryRow
from app.stock.domain.entry import Origin


class SqlPurchases:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def purchases(self) -> list[PurchaseRecord]:
        factor = money_scale_factor(self._session, self._business_id)
        statement = select(
            StockEntryRow.entered_on, scaled(StockEntryRow.total_cost, factor)
        ).where(
            StockEntryRow.business_id == self._business_id,
            StockEntryRow.origin == Origin.PURCHASE.value,
        )
        return [
            PurchaseRecord(
                day=day, total_cost=domain_amount(self._session, self._business_id, hundredths or 0)
            )
            for day, hundredths in self._session.execute(statement).all()
        ]

    def earliest_entry_day(self) -> date | None:
        statement = select(func.min(StockEntryRow.entered_on)).where(
            StockEntryRow.business_id == self._business_id
        )
        return self._session.scalar(statement)
