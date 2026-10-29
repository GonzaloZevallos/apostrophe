"""The `Thresholds` port over `stock_threshold` (CONTEXT.md: Low-stock threshold).
Built for one business; every statement filters on it, and it never commits
(CODING_STANDARDS section 9) — the use case commits once, through `Transaction`.
Turning a threshold off deletes its row rather than storing a null.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.quantity import Quantity
from app.stock.adapters.tables import StockThresholdRow
from app.stock.domain.threshold import Threshold


class SqlThresholds:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self, variety_id: int) -> Threshold | None:
        row = self._row(variety_id)
        return None if row is None else Threshold(Quantity(row.threshold_hundredths))

    def all(self) -> dict[int, Threshold]:
        statement = select(StockThresholdRow).where(
            StockThresholdRow.business_id == self._business_id
        )
        return {
            row.variety_id: Threshold(Quantity(row.threshold_hundredths))
            for row in self._session.scalars(statement)
        }

    def set(self, variety_id: int, threshold: Threshold) -> None:
        row = self._row(variety_id)
        if row is None:
            self._session.add(
                StockThresholdRow(
                    business_id=self._business_id,
                    variety_id=variety_id,
                    threshold_hundredths=threshold.quantity.hundredths,
                )
            )
        else:
            row.threshold_hundredths = threshold.quantity.hundredths
        self._session.flush()

    def clear(self, variety_id: int) -> None:
        row = self._row(variety_id)
        if row is not None:
            self._session.delete(row)
            self._session.flush()

    def _row(self, variety_id: int) -> StockThresholdRow | None:
        statement = select(StockThresholdRow).where(
            StockThresholdRow.business_id == self._business_id,
            StockThresholdRow.variety_id == variety_id,
        )
        return self._session.scalar(statement)
