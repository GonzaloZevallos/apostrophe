"""The `CatalogStock` port over stock's own `read_stock` (CODING_STANDARDS section 1:
only modules under `app/catalog/adapters/` import `app.stock`). Built for one business;
reuses stock's own `read_stock` so both agree about what counts as sold out or low —
the catalog never computes a stock status itself (the plan's invariant).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.catalog.domain.variety import StockStatus
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.adapters.sql_thresholds import SqlThresholds
from app.stock.adapters.variety_catalog import SqlVarietyCatalog
from app.stock.application.read_stock import read_stock


class StockStatusesFromStock:
    def __init__(self, session: Session, business_id: int) -> None:
        self._entries = SqlStockEntries(session, business_id)
        self._draws = SqlDraws(session, business_id)
        self._withdrawals = SqlStockWithdrawals(session, business_id)
        self._catalog = SqlVarietyCatalog(session, business_id)
        self._thresholds = SqlThresholds(session, business_id)

    def statuses(self, day: date) -> dict[int, StockStatus]:
        view = read_stock(
            self._entries, self._draws, self._withdrawals, self._catalog, self._thresholds, day
        )
        return {variety.variety_id: variety.level.status for variety in view.varieties}
