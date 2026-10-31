"""`DueBusinesses`'s one SQL adapter (plan, "Day change"): every business with a pin
published (`last_published_at` set) whose `last_checked_on` is empty or differs from its
own today at the given instant (ADR-0057: "differs", not "is earlier", so a business that
moved its zone west is checked once more).

The rule is evaluated per business in Python, because each business has its own zone.
A row whose stored zone cannot be loaded is skipped: it affects only its own business
and nothing raises out of the loop.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow
from app.pinned_catalog.application.ports import BusinessZones
from app.shared.calendar import business_day, load_zone


class SqlDueBusinesses:
    def __init__(self, engine: Engine, zones: BusinessZones) -> None:
        self._engine = engine
        self._zones = zones

    def due(self, instant: datetime) -> list[int]:
        with Session(self._engine) as session:
            published = session.execute(
                select(PinnedCatalogRow.business_id, PinnedCatalogRow.last_checked_on).where(
                    PinnedCatalogRow.last_published_at.is_not(None)
                )
            ).all()
        names = self._zones.zones()
        due: list[int] = []
        for business_id, last_checked_on in published:
            try:
                name = names.get(business_id)
                zone = None if name is None else load_zone(name)
                if zone is None:
                    continue
                if last_checked_on is None or last_checked_on != business_day(instant, zone):
                    due.append(business_id)
            except (ZoneInfoNotFoundError, ValueError, OSError):
                continue
        return due
