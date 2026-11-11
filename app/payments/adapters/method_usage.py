"""Whether a payment method has payments, read from the `payment` table
(docs/adr/0084). The payment methods hexagon asks through its own `PaymentMethodUsage`
protocol; this adapter answers it and is wired in `app/main.py`."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.payments.adapters.tables import PaymentRow


class PaymentsUsingAMethod:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]:
        if not method_ids:
            return frozenset()
        return frozenset(
            self._session.scalars(
                select(PaymentRow.payment_method_id)
                .where(
                    PaymentRow.business_id == self._business_id,
                    PaymentRow.payment_method_id.in_(list(method_ids)),
                )
                .distinct()
            )
        )
