"""Implements the Onboarding's `StockFacts` port (docs/adr/0036) for one business:
read-only, which varieties have a stock entry and how many entries there are. Every
statement filters on the business; it reads no grams and no cost."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.stock.adapters.tables import StockEntryRow


class SqlStockFacts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def stocked_variety_ids(self) -> set[int]:
        statement = (
            select(StockEntryRow.variety_id)
            .where(StockEntryRow.business_id == self._business_id)
            .distinct()
        )
        return set(self._session.scalars(statement))

    def stock_entries_count(self) -> int:
        statement = (
            select(func.count())
            .select_from(StockEntryRow)
            .where(StockEntryRow.business_id == self._business_id)
        )
        return self._session.scalar(statement) or 0
