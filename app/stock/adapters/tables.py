"""The stock tables (CONTEXT.md: Stock entry, Stock withdrawal, Low-stock threshold). Every table
carries `business_id`, not null, pointing at `business` (CODING_STANDARDS section 9).
`stock_threshold` is unique per `(business_id, variety_id)`: turning a threshold off
deletes its row rather than storing a null.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime
from app.stock.domain.draw_source import WithdrawalReason
from app.stock.domain.entry import NOTE_MAX_LENGTH

ORIGIN_MAX_LENGTH = 20
REASON_MAX_LENGTH = max(len(reason.value) for reason in WithdrawalReason)
_REASON_VALUES = ", ".join(f"'{reason.value}'" for reason in WithdrawalReason)


class StockEntryRow(Base):
    __tablename__ = "stock_entry"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    entry_date: Mapped[date]
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    origin: Mapped[str] = mapped_column(String(ORIGIN_MAX_LENGTH))
    # Signed: a negative adjustment takes grams away (app/shared/grams.py).
    grams_hundredths: Mapped[int]
    total_cost: Mapped[int | None]
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX_LENGTH))
    # Set once at creation from the injected clock; never changed by an edit. Lots and
    # draws are ordered only by it, through LotOrder (built elsewhere).
    recorded_at: Mapped[datetime] = mapped_column(UtcDateTime)


class StockThresholdRow(Base):
    __tablename__ = "stock_threshold"
    __table_args__ = (UniqueConstraint("business_id", "variety_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    threshold_hundredths: Mapped[int]


class StockWithdrawalRow(Base):
    """A stock withdrawal's header (CONTEXT.md: Stock withdrawal). An edit keeps `id` and
    `recorded_at`; only its lines are replaced."""

    __tablename__ = "stock_withdrawal"
    # The short rule name only: NAMING_CONVENTION gives `ck_stock_withdrawal_reason`.
    __table_args__ = (CheckConstraint(f"reason IN ({_REASON_VALUES})", "reason"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    reason: Mapped[str] = mapped_column(String(REASON_MAX_LENGTH))
    withdrawn_on: Mapped[date]
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX_LENGTH))
    recorded_at: Mapped[datetime] = mapped_column(UtcDateTime)


class StockWithdrawalLineRow(Base):
    __tablename__ = "stock_withdrawal_line"
    __table_args__ = (
        UniqueConstraint("stock_withdrawal_id", "position"),
        Index(None, "business_id", "variety_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    stock_withdrawal_id: Mapped[int] = mapped_column(ForeignKey("stock_withdrawal.id"))
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    position: Mapped[int]
    grams_hundredths: Mapped[int]
