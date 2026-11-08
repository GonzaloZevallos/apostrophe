from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column

from app.customers.domain.customer import NAME_MAX_LENGTH
from app.db import Base

PHONE_MAX_LENGTH = 16


class CustomerRow(Base):
    __tablename__ = "customer"
    # The only unique or check constraint on this table: uniqueness of a phone number
    # within a business is the one rule the database also enforces, so `SqlCustomers`
    # can translate exactly this `IntegrityError` into `PhoneTaken`. `vip` has no
    # `create_constraint`: the domain enforces it.
    __table_args__ = (
        UniqueConstraint("business_id", "phone"),
        # The in-use count and the guarded delete of a customer type walk this index.
        Index(None, "customer_type_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    # Nullable: a customer may have no phone (ADR-0021). `uq_customer_business_id_phone`
    # still applies only among non-null values; SQLite never treats two NULLs as equal.
    phone: Mapped[str | None] = mapped_column(String(PHONE_MAX_LENGTH))
    # Frozen (docs/adr/0059): kept with the values it holds, no longer read. A
    # server default and no Python default, so nothing here assigns it.
    vip: Mapped[bool] = mapped_column(server_default=false())
    # The customer's type, or none. No cascade: a type with customers is never deleted.
    customer_type_id: Mapped[int | None] = mapped_column(ForeignKey("customer_type.id"))
