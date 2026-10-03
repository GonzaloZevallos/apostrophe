"""Two of results' ports, implemented over payments' own storage (plan, subtask
"PaymentsReceived and DebtSummary in payments"): `app.state.payments_received` and
`app.state.debt_summary` in `app/main.py` wire both the same shape `app.state.balances`
already uses for `SqlBalances` — a `(Session, business_id)` factory per request
(ADR-0006).

Adapters may import anything (CODING_STANDARDS section 1), so this is the one place
payments reaches `app.results`' own types; `app/payments/domain/` and
`app/payments/application/` never do.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.payments.adapters.sql_ledgers import SqlLedgers
from app.payments.adapters.tables import PaymentRow
from app.payments.application.view_accounts import debtors as debtors_use_case
from app.payments.domain.received import ReceivedPayment, received_in
from app.results.application.ports import DebtorRow, Debts
from app.results.domain.periods import Period


class SqlPaymentsReceived:
    """Every payment counted on its own `paid_on`, on-the-spot and later alike (PRD:
    "What Caja counts"): no kind filter, and no join through `Ledgers` — a payment on
    a sale with no customer counts too. One load over the periods' own min..max, then
    `received_in` sums each period in Python (plan invariant: no SQL `SUM` or other
    aggregate over payments is added anywhere)."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def totals(self, periods: Sequence[Period]) -> Mapping[Period, int]:
        if not periods:
            return {}
        start = min(period.start for period in periods)
        end = max(period.end for period in periods)
        rows = self._session.execute(
            select(PaymentRow.paid_on, PaymentRow.amount).where(
                PaymentRow.business_id == self._business_id,
                PaymentRow.paid_on >= start,
                PaymentRow.paid_on <= end,
            )
        ).all()
        payments = [ReceivedPayment(paid_on=row.paid_on, amount=row.amount) for row in rows]
        return {
            period: received_in(payments, period.start, period.end) for period in periods
        }


class SqlDebtSummary:
    """`view_accounts.debtors()` unchanged, mapped to results' own `Debts`/`DebtorRow`
    by keyword, keeping `debtors()`'s order (plan: subtask brief) — never re-sorted or
    re-queried here."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._ledgers = SqlLedgers(session, business_id)

    def read(self) -> Debts:
        answer = debtors_use_case(self._ledgers)
        rows: list[DebtorRow] = []
        for debtor in answer.debtors:
            # `debtors()` only ever includes a standing of "owes" (payments-domain),
            # and a balance above $0 always leaves a sale still owing, so
            # `owing_since` is never `None` here (the same invariant `view_accounts`
            # itself relies on).
            assert debtor.owing_since is not None
            rows.append(
                DebtorRow(
                    customer_id=debtor.customer_id,
                    name=debtor.name,
                    balance=debtor.balance,
                    owing_since=debtor.owing_since,
                )
            )
        return Debts(
            total_owed=answer.total_owed,
            sales_owing_count=answer.sales_owing_count,
            debtors=tuple(rows),
        )
