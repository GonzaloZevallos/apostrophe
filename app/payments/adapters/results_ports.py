"""`DebtSummary`, results' port, implemented over payments' own storage (plan, subtask
"PaymentsReceived and DebtSummary in payments"; ADR-0013 amendment GH-70 deleted this
module's `PaymentsReceived` sibling — Caja now comes from `period_figures` like every
other period figure, fed from the same `PaymentsLedger` `analyse` already uses).
`app.state.debt_summary` in `app/main.py` wires this the same shape `app.state.balances`
already uses for `SqlBalances` — a `(Session, business_id)` factory per request
(ADR-0006).

Adapters may import anything (CODING_STANDARDS section 1), so this is the one place
payments reaches `app.results`' own types; `app/payments/domain/` and
`app/payments/application/` never do.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.payments.adapters.sql_ledgers import SqlLedgers
from app.payments.application.view_accounts import debtors as debtors_use_case
from app.results.application.ports import DebtorRow, Debts


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
