"""The `onboarding` table (CONTEXT.md: Onboarding; docs/adr/0036): one row per business
that is offered the Onboarding, inserted when its new-business invitation is accepted.
A business with no row is never offered one: no backfill, and no row for a joined
business. The four optional steps' passes are nullable (`done` or `skipped`); a required
step is derived from the data and stored nowhere. `ended_at` is set once and never
cleared.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime
from app.onboarding.domain.onboarding import Pass

PASS_MAX_LENGTH = 7
_PASS_VALUES = ", ".join(f"'{value.value}'" for value in Pass)


class OnboardingRow(Base):
    __tablename__ = "onboarding"
    # The short rule names only: NAMING_CONVENTION gives `ck_onboarding_<name>`, and the
    # unique one below `uq_onboarding_business_id`.
    __table_args__ = (
        CheckConstraint(f"header_footer_pass IN ({_PASS_VALUES})", "header_footer_pass"),
        CheckConstraint(f"bot_pass IN ({_PASS_VALUES})", "bot_pass"),
        CheckConstraint(f"partner_pass IN ({_PASS_VALUES})", "partner_pass"),
        CheckConstraint(f"categories_pass IN ({_PASS_VALUES})", "categories_pass"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    header_footer_pass: Mapped[str | None] = mapped_column(String(PASS_MAX_LENGTH))
    bot_pass: Mapped[str | None] = mapped_column(String(PASS_MAX_LENGTH))
    partner_pass: Mapped[str | None] = mapped_column(String(PASS_MAX_LENGTH))
    categories_pass: Mapped[str | None] = mapped_column(String(PASS_MAX_LENGTH))
    ended_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)


class FirstRunRow(Base):
    """One row per business, created when its first stamp is written (docs/adr/0046):
    the three first-run facts the data cannot say, each `NULL` until it happened, then
    set once and never cleared or moved. A business with no row has none of them. No
    checklist step is stored here."""

    __tablename__ = "first_run"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"), unique=True)
    checklist_gone_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    imported_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    import_notice_over_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
