from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.customers.domain.customer import NAME_MAX_LENGTH
from app.db import Base

PHONE_MAX_LENGTH = 16
CHANNEL_MAX_LENGTH = 16


class CustomerRow(Base):
    __tablename__ = "customer"
    # The only unique or check constraint on this table: uniqueness of a phone number
    # within a business is the one rule the database also enforces, so `SqlCustomers`
    # can translate exactly this `IntegrityError` into `PhoneTaken`. `channel` has no
    # CHECK and `vip` has no `create_constraint`: the domain enforces both.
    __table_args__ = (UniqueConstraint("business_id", "phone", name="uq_customer_business_phone"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    # Nullable: a customer may have no phone (ADR-0019). `uq_customer_business_phone`
    # still applies only among non-null values; SQLite never treats two NULLs as equal.
    phone: Mapped[str | None] = mapped_column(String(PHONE_MAX_LENGTH))
    channel: Mapped[str | None] = mapped_column(String(CHANNEL_MAX_LENGTH))
    vip: Mapped[bool] = mapped_column(default=False)
