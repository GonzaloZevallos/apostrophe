"""The stock tables (CONTEXT.md: Stock entry, Stock withdrawal, Low-stock threshold). Every table
carries `business_id`, not null, pointing at `business` (CODING_STANDARDS section 9).
`stock_threshold` is unique per `(business_id, variety_id)`: turning a threshold off
deletes its row rather than storing a null.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime, money_column
from app.stock.domain.entry import NOTE_MAX_LENGTH
from app.stock.domain.withdrawal_reason import NAME_MAX_LENGTH

ORIGIN_MAX_LENGTH = 20
# The frozen `stock_withdrawal.reason` column (migration 0022): nothing reads or writes it
# any more, and its check stays as the migration that made it left it.
LEGACY_REASON_MAX_LENGTH = 9


class StockEntryRow(Base):
    __tablename__ = "stock_entry"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    entered_on: Mapped[date]
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    origin: Mapped[str] = mapped_column(String(ORIGIN_MAX_LENGTH))
    # Signed: a negative adjustment takes grams away (app/shared/quantity.py).
    grams_hundredths: Mapped[int]
    total_cost: Mapped[int | None] = money_column(nullable=True)
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


class WithdrawalReasonRow(Base):
    """A business's own withdrawal reason (CONTEXT.md: Withdrawal reason). `name_key` is
    `app.shared.names.name_key(name)`, unique per business; `position` orders the list
    and is read together with `id`, so a tie from two concurrent adds stays stable."""

    __tablename__ = "withdrawal_reason"
    __table_args__ = (
        UniqueConstraint("business_id", "name_key"),
        UniqueConstraint("business_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    position: Mapped[int]


class StockWithdrawalRow(Base):
    """A stock withdrawal's header (CONTEXT.md: Stock withdrawal). An edit keeps `id` and
    `recorded_at`; only its lines are replaced."""

    __tablename__ = "stock_withdrawal"
    # The short rule name only: NAMING_CONVENTION gives `ck_stock_withdrawal_reason`. The
    # composite FK is the backstop for `WithdrawalReason.check_removable`: no withdrawal is
    # ever left pointing at a reason removed out from under it, and a reason of another
    # business can never be attached to this business's withdrawal.
    __table_args__ = (
        CheckConstraint("reason IN ('promotion','own_use')", "reason"),
        ForeignKeyConstraint(
            ["business_id", "withdrawal_reason_id"],
            ["withdrawal_reason.business_id", "withdrawal_reason.id"],
            ondelete="RESTRICT",
        ),
        Index(None, "business_id", "withdrawal_reason_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    withdrawal_reason_id: Mapped[int]
    # Frozen: new rows leave it empty and no code reads it.
    reason: Mapped[str | None] = mapped_column(String(LEGACY_REASON_MAX_LENGTH))
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
