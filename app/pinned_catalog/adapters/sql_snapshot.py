"""`PinSnapshots`'s one SQL adapter (plan, "How a sync runs"): opens its own
`Session(engine)`, reads the settings (decrypted token included, through the settings
repository's own `_settings_from_row`), the pin facts and the publishable catalog text,
then closes the session — so no database session stays open while Telegram is called.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.publishable_catalog import publishable_text
from app.pinned_catalog.adapters.sql_settings import settings_from_row
from app.pinned_catalog.adapters.tables import PinnedCatalogRow
from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.application.ports import PinFacts, PinSnapshot
from app.pinned_catalog.domain.status import PinFailure


def _facts_from_row(row: PinnedCatalogRow | None) -> PinFacts:
    if row is None:
        return PinFacts(
            message_id=None,
            message_chat=None,
            message_token_fingerprint=None,
            last_published_text=None,
            last_published_at=None,
            last_failure=None,
            last_checked_on=None,
        )
    return PinFacts(
        message_id=row.message_id,
        message_chat=row.message_chat,
        message_token_fingerprint=row.message_token_fingerprint,
        last_published_text=row.last_published_text,
        last_published_at=row.last_published_at,
        last_failure=PinFailure(row.last_failure) if row.last_failure is not None else None,
        last_checked_on=row.last_checked_on,
    )


class SqlPinSnapshots:
    def __init__(self, engine: Engine, cipher: TokenCipher) -> None:
        self._engine = engine
        self._cipher = cipher

    def snapshot(self, business_id: int, today: date) -> PinSnapshot:
        with Session(self._engine) as session:
            row = session.scalar(
                select(PinnedCatalogRow).where(PinnedCatalogRow.business_id == business_id)
            )
            settings = settings_from_row(row, self._cipher)
            facts = _facts_from_row(row)
            text = publishable_text(session, business_id, today)
            return PinSnapshot(settings=settings, pin=facts, text=text)
