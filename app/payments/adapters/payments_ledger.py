"""`PaymentsLedger`: results' port for every payment, on-the-spot and later alike
(ADR-0013). Built for one business."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.payments.adapters.tables import PaymentRow
from app.results.application.ports import PaymentRecord


class SqlPaymentsLedger:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> list[PaymentRecord]:
        statement = select(PaymentRow.paid_on, PaymentRow.amount).where(
            PaymentRow.business_id == self._business_id
        )
        return [
            PaymentRecord(day=paid_on, amount=amount)
            for paid_on, amount in self._session.execute(statement).all()
        ]
