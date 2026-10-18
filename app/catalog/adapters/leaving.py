"""What the catalog removes of its own when a variety is deleted: its attributes row."""

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.catalog.adapters.tables import CatalogAttributesRow


class SqlCatalogLeaving:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def leaving(self, variety_id: int) -> None:
        self._session.execute(
            delete(CatalogAttributesRow).where(
                CatalogAttributesRow.variety_id == variety_id,
                CatalogAttributesRow.business_id == self._business_id,
            )
        )
