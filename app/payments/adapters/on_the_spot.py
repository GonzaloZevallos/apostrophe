"""Payments' implementation of sales' `OnTheSpotPayments` port (docs/adr/0082): the only
code that writes the `payment` row of a sale. Sales never writes `PaymentRow` itself."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import delete as sa_delete
from sqlalchemy import insert, literal, select, update
from sqlalchemy.orm import Session

from app.db import money_stored_value
from app.payment_methods.adapters.tables import PaymentMethodRow
from app.payments.adapters.tables import PaymentRow
from app.shared.money import Money
from app.shared.payment_method import PaymentMethodUnavailable


class SqlOnTheSpotPayments:
    """Built for one business: every statement filters on it."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def record(
        self,
        sale_id: int,
        customer_id: int | None,
        paid_on: date,
        amount: int,
        payment_method_id: int,
        recorded_at: datetime,
    ) -> None:
        """One `INSERT … SELECT` that resolves the method inside the statement, against
        this business and `archived_at IS NULL`: when it finds none, no row is written and
        `PaymentMethodUnavailable` is raised. Never commits."""
        guarded = select(
            literal(self._business_id),
            literal(customer_id),
            literal(sale_id),
            literal(paid_on),
            literal(money_stored_value(self._session, self._business_id, Money.of_units(amount))),
            PaymentMethodRow.id,
            literal(recorded_at),
        ).where(
            PaymentMethodRow.id == payment_method_id,
            PaymentMethodRow.business_id == self._business_id,
            PaymentMethodRow.archived_at.is_(None),
        )
        statement = (
            insert(PaymentRow)
            .from_select(
                [
                    "business_id",
                    "customer_id",
                    "sale_id",
                    "paid_on",
                    "amount",
                    "payment_method_id",
                    "recorded_at",
                ],
                guarded,
            )
            .returning(PaymentRow.id)
        )
        if self._session.execute(statement).first() is None:
            raise PaymentMethodUnavailable()
        self._session.flush()

    def remove_for(self, sale_id: int) -> None:
        self._session.execute(
            sa_delete(PaymentRow).where(
                PaymentRow.sale_id == sale_id, PaymentRow.business_id == self._business_id
            )
        )
        self._session.flush()

    def assign_customer(self, sale_id: int, customer_id: int) -> None:
        """Follows the sale's customer; only a payment that has none yet."""
        self._session.execute(
            update(PaymentRow)
            .where(
                PaymentRow.sale_id == sale_id,
                PaymentRow.business_id == self._business_id,
                PaymentRow.customer_id.is_(None),
            )
            .values(customer_id=customer_id)
        )
        self._session.flush()
