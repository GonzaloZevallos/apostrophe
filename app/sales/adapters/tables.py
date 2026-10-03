"""The sales tables (CONTEXT.md: Sale, Sale line; docs/adr/0007).

`payment` now lives in `app/payments/adapters/tables.py` (#4's payments hexagon),
moved there with no migration: its name and columns are unchanged. `SqlSales` still
writes and deletes on-the-spot rows there, adapter-to-adapter, the same way it already
reads `CustomerRow` and `VarietyRow`. Every table carries `business_id`, not null,
pointing at `business` (CODING_STANDARDS section 9).
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime
from app.sales.domain.sale import NOTE_MAX_LENGTH

PRICING_RULE_MAX_LENGTH = 10


class SaleRow(Base):
    __tablename__ = "sale"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    sale_date: Mapped[date]
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customer.id"))
    shipping_charged: Mapped[int]
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX_LENGTH))
    recorded_at: Mapped[datetime] = mapped_column(UtcDateTime)


class SaleLineRow(Base):
    __tablename__ = "sale_line"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    sale_id: Mapped[int] = mapped_column(ForeignKey("sale.id"))
    variety_id: Mapped[int] = mapped_column(ForeignKey("variety.id"))
    grams_hundredths: Mapped[int]
    pricing_rule: Mapped[str] = mapped_column(String(PRICING_RULE_MAX_LENGTH))
    price_per_gram: Mapped[int]
    line_total: Mapped[int]
    position: Mapped[int]
