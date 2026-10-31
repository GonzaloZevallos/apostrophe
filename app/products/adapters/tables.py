from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UtcDateTime
from app.products.domain.product import NAME_MAX_LENGTH


class ProductRow(Base):
    __tablename__ = "variety"
    # The casefolded name is what makes two names the same name, within one business.
    __table_args__ = (UniqueConstraint("business_id", "name_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    unit_id: Mapped[int] = mapped_column(ForeignKey("unit.id"), index=True)
    # The instant the variety left the lists; null while it is live (docs/adr/0032).
    archived_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    price_entries: Mapped[list[PriceEntryRow]] = relationship(
        back_populates="variety", cascade="all, delete-orphan"
    )


class PriceEntryRow(Base):
    __tablename__ = "price_entry"
    __table_args__ = (UniqueConstraint("variety_id", "effective_from"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Redundant with the variety's on purpose: every row says whose it is (docs/adr/0004).
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    effective_from: Mapped[date]
    list_price: Mapped[int]
    bulk_price: Mapped[int | None]
    bulk_minimum_hundredths: Mapped[int | None]
    vip_price: Mapped[int | None]
    variety: Mapped[ProductRow] = relationship(back_populates="price_entries")
