"""The settings repository (CODING_STANDARDS §9: "a stored token that fails to decrypt
is read as no token saved, in the settings repository only" — this module, and the only
place that catches `InvalidToken`). `SqlSettingsWriter` is the one `SettingsWriter`
adapter; `_settings_from_row` is shared with `sql_snapshot.py` so a snapshot's settings
and a freshly-saved settings answer are read the exact same way.
"""

from __future__ import annotations

from datetime import date

from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow
from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.application.ports import SettingsSnapshot


def settings_from_row(row: PinnedCatalogRow | None, cipher: TokenCipher) -> SettingsSnapshot:
    """Shared with `sql_snapshot.py`, so a snapshot's settings and a freshly-saved
    settings answer are read the exact same way — the one place that catches
    `InvalidToken` (CODING_STANDARDS §9)."""
    if row is None:
        return SettingsSnapshot(
            token=None,
            token_fingerprint=None,
            token_saved_on=None,
            own_chat=None,
            channel_chat=None,
        )
    token: str | None = None
    fingerprint = row.token_fingerprint
    saved_on = row.token_saved_on
    if row.token_ciphertext is not None:
        try:
            token = cipher.decrypt(row.token_ciphertext)
        except InvalidToken:
            token = None
            fingerprint = None
            saved_on = None
    return SettingsSnapshot(
        token=token,
        token_fingerprint=fingerprint,
        token_saved_on=saved_on,
        own_chat=row.own_chat,
        channel_chat=row.channel_chat,
    )


def _row_for(session: Session, business_id: int) -> PinnedCatalogRow | None:
    return session.scalar(
        select(PinnedCatalogRow).where(PinnedCatalogRow.business_id == business_id)
    )


class SqlSettingsWriter:
    """Called only by `test_send`, and only after a successful send (the plan's
    invariant). Opens its own `Session(engine)`, never the request's."""

    def __init__(self, engine: Engine, cipher: TokenCipher) -> None:
        self._engine = engine
        self._cipher = cipher

    def save(
        self,
        business_id: int,
        token: str | None,
        own_chat: str,
        channel_chat: str | None,
        saved_on: date,
    ) -> SettingsSnapshot:
        with Session(self._engine) as session:
            row = _row_for(session, business_id)
            if row is None:
                row = PinnedCatalogRow(business_id=business_id)
                session.add(row)
            if token is not None:
                row.token_ciphertext = self._cipher.encrypt(token)
                row.token_fingerprint = self._cipher.fingerprint(token)
                row.token_saved_on = saved_on
            row.own_chat = own_chat
            row.channel_chat = channel_chat
            session.commit()
            return settings_from_row(row, self._cipher)
