"""`PinRecorder`'s one SQL adapter (plan, "How a sync runs"): writes the pin facts in
one short transaction, guarded on the row's current token fingerprint and channel chat
still equalling what `push` read at snapshot time — so a settings change racing a send
in flight never overwrites what the new settings themselves will record.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow
from app.pinned_catalog.domain.status import PinFailure


class SqlPinRecorder:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def record(
        self,
        business_id: int,
        expected_token_fingerprint: str | None,
        expected_channel_chat: str | None,
        *,
        message_id: int | None,
        message_chat: str | None,
        message_token_fingerprint: str | None,
        last_published_text: str | None,
        last_published_at: datetime | None,
        last_failure: PinFailure | None,
        last_checked_on: date | None,
    ) -> None:
        with Session(self._engine) as session:
            row = session.scalar(
                select(PinnedCatalogRow).where(PinnedCatalogRow.business_id == business_id)
            )
            if row is None:
                if expected_token_fingerprint is not None or expected_channel_chat is not None:
                    return  # the settings changed since the read; never create a stale row
                row = PinnedCatalogRow(business_id=business_id)
                session.add(row)
            elif (
                row.token_fingerprint != expected_token_fingerprint
                or row.channel_chat != expected_channel_chat
            ):
                return
            row.message_id = message_id
            row.message_chat = message_chat
            row.message_token_fingerprint = message_token_fingerprint
            row.last_published_text = last_published_text
            row.last_published_at = last_published_at
            row.last_failure = last_failure.value if last_failure is not None else None
            row.last_checked_on = last_checked_on
            session.commit()
