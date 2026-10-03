"""The stock tables (CONTEXT.md: Stock entry, Low-stock threshold). Every table
carries `business_id`, not null, pointing at `business` (CODING_STANDARDS section 9).
`stock_threshold` is unique per `(business_id, variety_id)`: turning a threshold off
deletes its row rather than storing a null.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime
from app.stock.domain.entry import NOTE_MAX_LENGTH

ORIGIN_MAX_LENGTH = 20


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
