"""Delete a mistaken later payment (CONTEXT.md: Payment)."""

from __future__ import annotations

from app.payments.application.errors import OnTheSpot, PaymentNotFound
from app.payments.application.ports import Payments
from app.shared.transaction import Transaction


def delete_payment(payments: Payments, transaction: Transaction, payment_id: int) -> None:
    """`get` -> `None` gives `PaymentNotFound`; a row with a `sale_id` gives
    `OnTheSpot` — the delete decides "on the spot" only on the row this read just
    returned, so another business's payment of either kind answers `PaymentNotFound`,
    never `OnTheSpot` (the plan's invariant). Otherwise `delete_later`, and a
    `rowcount` of 0 (the row vanished between the read and the delete) also gives
    `PaymentNotFound`."""
    stored = payments.get(payment_id)
    if stored is None:
        raise PaymentNotFound()
    if stored.sale_id is not None:
        raise OnTheSpot()
    if payments.delete_later(payment_id) == 0:
        raise PaymentNotFound()
    transaction.commit()
