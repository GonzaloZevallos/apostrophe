"""`PaymentsLedger`: results' port for every payment, on-the-spot and later alike
(ADR-0020). Built for one business."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import domain_amount, money_scale_factor, scaled
from app.payments.adapters.tables import PaymentRow
from app.results.application.ports import PaymentRecord


class SqlPaymentsLedger:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> list[PaymentRecord]:
        factor = money_scale_factor(self._session, self._business_id)
        statement = select(PaymentRow.paid_on, scaled(PaymentRow.amount, factor)).where(
            PaymentRow.business_id == self._business_id
        )
        return [
            PaymentRecord(
                day=paid_on, amount=domain_amount(self._session, self._business_id, amount)
            )
            for paid_on, amount in self._session.execute(statement).all()
        ]
