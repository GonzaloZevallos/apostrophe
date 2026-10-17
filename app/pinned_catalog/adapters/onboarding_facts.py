"""Implements the Onboarding's `BotFacts` port (docs/adr/0036, docs/adr/0046) for one
business: read-only, whether bot settings are saved and whether the catalog was ever
published. It reads presence only, never the token (CODING_STANDARDS section 9)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow


class SqlBotFacts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def is_bot_saved(self) -> bool:
        statement = select(PinnedCatalogRow.id).where(
            PinnedCatalogRow.business_id == self._business_id,
            PinnedCatalogRow.token_ciphertext.is_not(None),
        )
        return self._session.scalar(statement) is not None

    def has_ever_published(self) -> bool:
        # `last_published_at` is only ever overwritten with itself or a newer instant by
        # the recorder, never back to null, so a stamp here is forever.
        statement = select(PinnedCatalogRow.id).where(
            PinnedCatalogRow.business_id == self._business_id,
            PinnedCatalogRow.last_published_at.is_not(None),
        )
        return self._session.scalar(statement) is not None
