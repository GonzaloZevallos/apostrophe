"""The `Payments` port over SQLAlchemy, for one business (docs/adr/0004, docs/adr/0012):
`insert_later` and `delete_later` are its only writes, and both touch only `LATER`
rows — a later payment never carries a `sale_id` (the plan's invariant).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import cast

from sqlalchemy import CursorResult, func, insert, literal, null, select
from sqlalchemy import delete as sa_delete
from sqlalchemy.orm import Session

from app.payments.adapters.tables import LATER, PaymentRow
from app.payments.application.ports import StoredPayment
from app.payments.domain.payment import PaymentAboveBalance
from app.payments.domain.settlement import PaymentMethod
from app.sales.adapters.tables import SaleLineRow, SaleRow


class SqlPayments:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self, payment_id: int) -> StoredPayment | None:
        row = self._session.execute(
            select(PaymentRow.id, PaymentRow.sale_id).where(
                PaymentRow.id == payment_id, PaymentRow.business_id == self._business_id
            )
        ).first()
        return None if row is None else StoredPayment(id=row.id, sale_id=row.sale_id)

    def insert_later(
        self,
        customer_id: int,
        paid_on: date,
        amount: int,
        method: PaymentMethod,
        recorded_at: datetime,
    ) -> int:
        """One `INSERT … SELECT … WHERE :amount <= bought - paid` (ADR-0012): bought
        is shipping summed over `sale` plus line totals summed over `sale_line`, in
        separate scalar subqueries, never one sum over their join; paid is every
        payment of the customer. Every subquery filters on `business_id` and
        `customer_id`. No returned row — the row the guard would read having changed
        since the domain's own check, or simply wrong — raises `PaymentAboveBalance`
        and leaves no row behind: never a read followed by an unconditional insert.

        The new id comes from the statement's own `RETURNING`, never
        `CursorResult.lastrowid`: that DBAPI-specific accessor comes back `None` for a
        result-less `INSERT … SELECT` on the libsql driver (ADR-0016), though the
        statement itself inserts the row correctly; `RETURNING` works the same way on
        both drivers.
        """
        shipping = (
            select(func.coalesce(func.sum(SaleRow.shipping_charged), 0))
            .where(
                SaleRow.business_id == self._business_id,
                SaleRow.customer_id == customer_id,
            )
            .scalar_subquery()
        )
        line_totals = (
            select(func.coalesce(func.sum(SaleLineRow.line_total), 0))
            .select_from(SaleLineRow)
            .join(SaleRow, SaleRow.id == SaleLineRow.sale_id)
            .where(
                SaleLineRow.business_id == self._business_id,
                SaleRow.customer_id == customer_id,
            )
            .scalar_subquery()
        )
        paid = (
            select(func.coalesce(func.sum(PaymentRow.amount), 0))
            .where(
                PaymentRow.business_id == self._business_id,
                PaymentRow.customer_id == customer_id,
            )
            .scalar_subquery()
        )

        guarded_select = select(
            literal(self._business_id),
            literal(customer_id),
            null(),
            literal(paid_on),
            literal(amount),
            literal(method.value),
            literal(recorded_at),
        ).where(literal(amount) <= (shipping + line_totals) - paid)

        statement = (
            insert(PaymentRow)
            .from_select(
                [
                    "business_id",
                    "customer_id",
                    "sale_id",
                    "paid_on",
                    "amount",
                    "method",
                    "recorded_at",
                ],
                guarded_select,
            )
            .returning(PaymentRow.id)
        )
        row = self._session.execute(statement).first()
        if row is None:
            raise PaymentAboveBalance()
        self._session.flush()
        return int(row.id)

    def delete_later(self, payment_id: int) -> int:
        result = cast(
            CursorResult[tuple[object, ...]],
            self._session.execute(
                sa_delete(PaymentRow).where(
                    PaymentRow.id == payment_id,
                    PaymentRow.business_id == self._business_id,
                    LATER,
                )
            ),
        )
        self._session.flush()
        return result.rowcount
