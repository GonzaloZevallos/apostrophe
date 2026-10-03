"""`SqlPeriodSales`: results' `PeriodSales` port (`app/results/application/ports.py`),
implemented over `SqlSales.between` (plan: "PeriodSales"). Sales never imports
`app.results.domain` or `app.results.application` the other way around — this is the
one adapter allowed to import results' port types, wired onto `app.state.period_sales`
in `app/main.py` (the same shape `app.state.line_costs` already uses).

One load over the whole span the periods cover, then `period_summary` run per period
in Python: no per-period query, so the fixed number of statements `between` already
holds (two) stays two whatever the number of periods passed in.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from sqlalchemy.orm import Session

from app.results.application.ports import SalesSummary
from app.results.domain.periods import Period
from app.sales.adapters.sql_sales import SqlSales
from app.sales.domain.period_summary import period_summary


class SqlPeriodSales:
    def __init__(self, session: Session, business_id: int) -> None:
        self._sales = SqlSales(session, business_id)

    def summaries(self, periods: Sequence[Period]) -> Mapping[Period, SalesSummary]:
        if not periods:
            return {}
        start = min(period.start for period in periods)
        end = max(period.end for period in periods)
        sales = self._sales.between(start, end)

        answer: dict[Period, SalesSummary] = {}
        for period in periods:
            in_period = [sale for sale in sales if period.start <= sale.date <= period.end]
            summary = period_summary(in_period)
            answer[period] = SalesSummary(
                total=summary.total,
                count=summary.count,
                grams_sold=summary.grams_sold,
                grams_gifted=summary.grams_gifted,
            )
        return answer
