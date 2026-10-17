"""`SqlBusinessUsers`: results' `BusinessUsers` port (`app/results/application/ports.py`),
the checklist's partner step. A bounded `SELECT … LIMIT 2` over the business's users: a
second one is a partner. A join link not yet accepted is an invitation, never a user, so it
does not count. Built for one business, wired onto `app.state.business_users`.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow


class SqlBusinessUsers:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def has_partner(self) -> bool:
        ids = self._session.scalars(
            select(UserRow.id).where(UserRow.business_id == self._business_id).limit(2)
        ).all()
        return len(ids) > 1
