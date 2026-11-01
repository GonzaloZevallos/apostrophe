"""Accounts' side of the zone Protocols the readers outside a request declare for
themselves (ADR-0055): `pinned_catalog`'s `BusinessZones`/`BusinessZone`.
`spreadsheet_import`'s `TargetZone` is served by `import_port.TargetZone`. They answer
the stored name only; each reader turns it into a zone with `load_zone` and decides what
an unloadable name means for it.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow


class SqlBusinessZones:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def zones(self) -> dict[int, str]:
        with Session(self._engine) as session:
            return {
                business_id: name
                for business_id, name in session.execute(
                    select(BusinessRow.id, BusinessRow.time_zone)
                )
            }

    def zone_of(self, business_id: int) -> str | None:
        with Session(self._engine) as session:
            return session.scalar(
                select(BusinessRow.time_zone).where(BusinessRow.id == business_id)
            )
