"""Implements the Onboarding's `UserFacts` port (docs/adr/0035) for one business:
read-only, how many users it has. Filtered by `business_id`."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow


class SqlUserFacts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def user_count(self) -> int:
        statement = (
            select(func.count())
            .select_from(UserRow)
            .where(UserRow.business_id == self._business_id)
        )
        return self._session.scalar(statement) or 0
