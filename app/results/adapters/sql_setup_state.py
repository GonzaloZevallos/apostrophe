"""`SetupStateStore`'s one SQL adapter (ADR-0024), built for one business and writing
only through `INSERT … ON CONFLICT(business_id) DO UPDATE SET col = COALESCE(col,
excluded.col)`: a fact once stored is never cleared and never moved, and a write of one
fact leaves the other as it stands. It never commits; the use case does, once.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.results.adapters.tables import InicioSetupStateRow
from app.results.domain.setup import StoredSetup

_TABLE = InicioSetupStateRow.__table__


class SqlSetupStateStore:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def read(self) -> StoredSetup:
        row = self._session.execute(
            select(
                InicioSetupStateRow.checklist_gone_at,
                InicioSetupStateRow.bot_notice_dismissed_at,
            ).where(InicioSetupStateRow.business_id == self._business_id)
        ).first()
        if row is None:
            return StoredSetup(checklist_gone=False, bot_notice_dismissed=False)
        gone_at, dismissed_at = row
        return StoredSetup(
            checklist_gone=gone_at is not None, bot_notice_dismissed=dismissed_at is not None
        )

    def mark_checklist_gone(self, now: datetime) -> None:
        self._keep_first("checklist_gone_at", now)

    def dismiss_bot_notice(self, now: datetime) -> None:
        self._keep_first("bot_notice_dismissed_at", now)

    def _keep_first(self, column: str, now: datetime) -> None:
        statement = insert(_TABLE).values({"business_id": self._business_id, column: now})
        self._session.execute(
            statement.on_conflict_do_update(
                index_elements=[_TABLE.c.business_id],
                set_={column: func.coalesce(_TABLE.c[column], statement.excluded[column])},
            )
        )
