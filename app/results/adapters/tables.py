"""Results' one table, `inicio_setup_state` (CONTEXT.md: Inicio's setup state): one row
per business, written into existence by the first fact stored. Both facts are moments
from the injected clock, and neither is ever cleared. No migration writes a row.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime


class InicioSetupStateRow(Base):
    __tablename__ = "inicio_setup_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    checklist_gone_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    bot_notice_dismissed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
