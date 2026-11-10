"""The stub `PaymentMethodUsage` the app is wired with until payments link to a method by
id (docs/adr/0082): no payment can point at a method yet, so none is in use. The piece
that adds `payment.payment_method_id` replaces it in `app/main.py`."""

from collections.abc import Sequence

from sqlalchemy.orm import Session


class NoPaymentUsesAMethodYet:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]:
        return frozenset()
