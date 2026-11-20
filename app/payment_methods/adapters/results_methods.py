"""`PaymentMethods`: results' port for the business's Payment methods, archived ones
included (`app/results/application/ports.py`). One statement, constant in history size;
`app/main.py` wires this once onto `app.state.results_payment_methods`. Built for one
business."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.payment_methods.adapters.tables import PaymentMethodRow
from app.results.application.ports import PaymentMethodRecord, PaymentMethods


class SqlResultsPaymentMethods(PaymentMethods):
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> Sequence[PaymentMethodRecord]:
        statement = select(
            PaymentMethodRow.id, PaymentMethodRow.name, PaymentMethodRow.position
        ).where(PaymentMethodRow.business_id == self._business_id)
        return [
            PaymentMethodRecord(payment_method_id=method_id, name=name, position=position)
            for method_id, name, position in self._session.execute(statement).all()
        ]
