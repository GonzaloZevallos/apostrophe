"""The `payment` table (CONTEXT.md: Payment; docs/adr/0007), moved here verbatim from
`app/sales/adapters/tables.py` with no migration: its name and columns are unchanged.

An on-the-spot payment carries a `sale_id`; a later one does not (the plan's
invariant). `LATER` and `ON_THE_SPOT` are the one way any statement in this product
tells the two apart; every payments statement uses them instead of writing
`sale_id.is_(None)` or `sale_id.is_not(None)` again.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UtcDateTime

PAYMENT_METHOD_MAX_LENGTH = 10


class PaymentRow(Base):
    __tablename__ = "payment"
    __table_args__ = (Index(None, "sale_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    paid_on: Mapped[date]
    amount: Mapped[int]
    method: Mapped[str] = mapped_column(String(PAYMENT_METHOD_MAX_LENGTH))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customer.id"))
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sale.id"))
    recorded_at: Mapped[datetime] = mapped_column(UtcDateTime)


LATER = PaymentRow.sale_id.is_(None)
ON_THE_SPOT = PaymentRow.sale_id.is_not(None)
