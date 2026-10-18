"""The `FirstRuns` port over the `first_run` table. Built for one business: every
statement filters on it, so another business's row is a row that does not exist. It
flushes and never commits."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.onboarding.adapters.tables import FirstRunRow
from app.onboarding.domain.first_run import FirstRun, Stamp


class SqlFirstRuns:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self) -> FirstRun | None:
        # Columns, not the entity: a row read before a stamp must not stay stale in the
        # session's identity map.
        statement = select(
            FirstRunRow.checklist_gone_at,
            FirstRunRow.imported_at,
            FirstRunRow.import_notice_over_at,
        ).where(FirstRunRow.business_id == self._business_id)
        row = self._session.execute(statement).one_or_none()
        if row is None:
            return None
        return FirstRun(
            checklist_gone_at=row.checklist_gone_at,
            imported_at=row.imported_at,
            import_notice_over_at=row.import_notice_over_at,
        )

    def stamp(self, column: Stamp, at: datetime) -> None:
        insert_statement = sqlite_insert(FirstRunRow).values(business_id=self._business_id)
        self._session.execute(
            insert_statement.on_conflict_do_nothing(index_elements=["business_id"])
        )
        target = getattr(FirstRunRow, column.value)
        self._session.execute(
            update(FirstRunRow)
            .where(FirstRunRow.business_id == self._business_id, target.is_(None))
            .values({column.value: at})
        )
        self._session.flush()

    def imported(self, at: datetime) -> None:
        self.stamp(Stamp.IMPORTED, at)
