from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime
from app.payment_methods.domain.method import NAME_MAX_LENGTH

ICON_MAX_LENGTH = 10


class PaymentMethodRow(Base):
    __tablename__ = "payment_method"
    # `name_key` is what makes two names the same name within one business, archived
    # rows included. The second constraint is the target of the composite foreign key a
    # payment points here with. `position` is deliberately not unique: a move swaps two
    # rows inside one statement.
    __table_args__ = (
        UniqueConstraint("business_id", "name_key"),
        UniqueConstraint("business_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    icon: Mapped[str] = mapped_column(String(ICON_MAX_LENGTH))
    position: Mapped[int]
    archived_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
