"""A payment-methods module that reaches `app.payments` and `app.expenses`: the direction
the check rejects."""

from app.expenses.adapters.tables import ExpenseRow
from app.payments.adapters.tables import PaymentRow

ROWS = (PaymentRow, ExpenseRow)
