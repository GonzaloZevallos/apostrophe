"""`SqlPeriodExpenses`: results' `PeriodExpenses` port (`app/results/application/ports.py`),
implemented from expenses' own data. Expenses never imports `app.results.application` or
`app.results.domain` from its own `application/` or `domain/` (CODING_STANDARDS section
1); this adapter is the one place that import runs, wired once onto
`app.state.period_expenses` in `app/main.py` — the same shape `app.state.line_costs`
already uses (ADR-0006).

One `SqlExpenses.between` load over the covering range of every period, then
`total_of` (expenses-domain) summed per period — never one query per period (plan:
"one load over min..max, then a sum per period").
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expenses import SqlExpenses
from app.expenses.domain.period_total import total_of
from app.results.domain.periods import Period


class SqlPeriodExpenses:
    def __init__(self, session: Session, business_id: int) -> None:
        self._expenses = SqlExpenses(session, business_id)

    def totals(self, periods: Sequence[Period]) -> Mapping[Period, int]:
        start = min(period.start for period in periods)
        end = max(period.end for period in periods)
        expenses = self._expenses.between(start, end)
        return {
            period: total_of(
                [e for e in expenses if period.start <= e.spent_on <= period.end]
            )
            for period in periods
        }
