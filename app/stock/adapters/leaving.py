"""What stock removes of its own when a variety is deleted: the variety's low-stock
threshold. Its entries are history, so a variety that has any is never deleted."""

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.stock.adapters.tables import StockThresholdRow


class SqlStockLeaving:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def leaving(self, variety_id: int) -> None:
        self._session.execute(
            delete(StockThresholdRow).where(
                StockThresholdRow.variety_id == variety_id,
                StockThresholdRow.business_id == self._business_id,
            )
        )
