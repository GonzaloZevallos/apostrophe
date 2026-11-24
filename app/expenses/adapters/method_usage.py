"""Whether a payment method has expenses, read from the `expense` table
(docs/adr/20261124-a-payment-method-is-in-use-when-any-payment-or-expense-points-at-it).

The payment methods hexagon asks through its own `PaymentMethodUsage` protocol; this
adapter answers for the expenses and is wired in `app/main.py` next to the payments one.
An expense with no method matches no id."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.expenses.adapters.tables import ExpenseRow


class ExpensesUsingAMethod:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]:
        if not method_ids:
            return frozenset()
        return frozenset(
            self._session.scalars(
                select(ExpenseRow.payment_method_id)
                .where(
                    ExpenseRow.business_id == self._business_id,
                    ExpenseRow.payment_method_id.in_(list(method_ids)),
                )
                .distinct()
            )
        )
