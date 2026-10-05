"""The single `pinned_catalog` table (CONTEXT.md: Bot settings, Pinned catalog, Out of
date), one row per business. Every column but `business_id` is nullable: a business
that never touched its bot settings has no row at all (unlike `catalog_header_footer`,
nothing seeds it at opening) — the settings and pin repositories read a missing row as
every field unset, and write it into existence on the first save or the first recorded
attempt.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime

FAILURE_MAX_LENGTH = 32


class PinnedCatalogRow(Base):
    __tablename__ = "pinned_catalog"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    token_ciphertext: Mapped[bytes | None] = mapped_column(LargeBinary)
    token_fingerprint: Mapped[str | None] = mapped_column(String(64))
    token_saved_on: Mapped[date | None]
    own_chat: Mapped[str | None] = mapped_column(String(200))
    channel_chat: Mapped[str | None] = mapped_column(String(200))
    message_id: Mapped[int | None]
    message_chat: Mapped[str | None] = mapped_column(String(200))
    message_token_fingerprint: Mapped[str | None] = mapped_column(String(64))
    last_published_text: Mapped[str | None] = mapped_column(Text)
    last_published_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_failure: Mapped[str | None] = mapped_column(String(FAILURE_MAX_LENGTH))
    last_checked_on: Mapped[date | None]
