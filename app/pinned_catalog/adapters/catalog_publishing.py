"""`SqlCatalogPublishing`: results' `CatalogPublishing` port
(`app/results/application/ports.py`). "Published at least once" is
`last_published_at IS NOT NULL`: no settings change clears it, and `SqlPinRecorder`
never writes it back to null, so it survives a new token or channel. One bounded `EXISTS`,
built for one business, wired onto `app.state.catalog_publishing`.
"""

from __future__ import annotations

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow


class SqlCatalogPublishing:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def ever_published(self) -> bool:
        probe = select(
            exists().where(
                PinnedCatalogRow.business_id == self._business_id,
                PinnedCatalogRow.last_published_at.is_not(None),
            )
        )
        return bool(self._session.scalar(probe))
