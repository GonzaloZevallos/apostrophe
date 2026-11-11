"""The sales tables (CONTEXT.md: Sale, Sale line; docs/adr/0007).

`payment` now lives in `app/payments/adapters/tables.py` (#4's payments hexagon),
moved there with no migration: its name and columns are unchanged. `SqlSales` still
writes and deletes on-the-spot rows there, adapter-to-adapter, the same way it already
reads `CustomerRow` and `VarietyRow`. Every table carries `business_id`, not null,
pointing at `business` (CODING_STANDARDS section 9).
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.customer_types.domain.customer_type import NAME_MAX_LENGTH as CUSTOMER_TYPE_NAME_MAX
from app.db import Base, UtcDateTime, money_column
from app.sales.domain.sale import NOTE_MAX_LENGTH

PRICING_RULE_MAX_LENGTH = 10


class SaleRow(Base):
    __tablename__ = "sale"
    __table_args__ = (
        Index(None, "business_id", "sold_on"),
        UniqueConstraint("business_id", "number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    # The Sale number (CONTEXT.md, docs/adr/0073): given only by `SqlSales.add`, never
    # defaulted, never reused.
    number: Mapped[int]
    sold_on: Mapped[date]
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customer.id"))
    shipping_charged: Mapped[int] = money_column()
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX_LENGTH))
    recorded_at: Mapped[datetime] = mapped_column(UtcDateTime)


class SaleLineRow(Base):
    __tablename__ = "sale_line"
    __table_args__ = (Index(None, "sale_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    sale_id: Mapped[int] = mapped_column(ForeignKey("sale.id"))
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    grams_hundredths: Mapped[int]
    pricing_rule: Mapped[str] = mapped_column(String(PRICING_RULE_MAX_LENGTH))
    price_per_gram: Mapped[int] = money_column()
    line_total: Mapped[int] = money_column()
    position: Mapped[int]
    # The type that priced the line and a copy of its name, written once with the line.
    # No foreign key: deleting a type never touches a recorded line (docs/adr/0059).
    customer_type_id: Mapped[int | None]
    customer_type_name: Mapped[str | None] = mapped_column(String(CUSTOMER_TYPE_NAME_MAX))
