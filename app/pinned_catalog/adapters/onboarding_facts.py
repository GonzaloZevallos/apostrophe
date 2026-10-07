"""Implements the Onboarding's `BotFacts` port (docs/adr/0035) for one business:
read-only, whether bot settings are saved. It reads presence only, never the token
(CODING_STANDARDS section 9)."""

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
