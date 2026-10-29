"""`BusinessNames` over the `business` table: the current name of one business, read
fresh. It selects the name alone and answers `None` for a missing row."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow


class SqlBusinessNames:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def current(self) -> str | None:
        return self._session.scalar(
            select(BusinessRow.name).where(BusinessRow.id == self._business_id)
        )
