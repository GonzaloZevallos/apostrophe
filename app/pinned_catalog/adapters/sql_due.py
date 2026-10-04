"""`DueBusinesses`'s one SQL adapter (plan, "Day change"): every business with a pin
published (`last_published_at` set) and not checked yet today — `last_checked_on` null
or before `today`."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow


class SqlDueBusinesses:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def due(self, today: date) -> list[int]:
        with Session(self._engine) as session:
            rows = session.scalars(
                select(PinnedCatalogRow.business_id).where(
                    PinnedCatalogRow.last_published_at.is_not(None),
                    (PinnedCatalogRow.last_checked_on.is_(None))
                    | (PinnedCatalogRow.last_checked_on < today),
                )
            )
            return list(rows)
