"""The panel's one use case (plan: subtask "Results core and GET /panel"): composes
the five owner ports into one answer, computing `periods(today)` once and passing
`today` and the periods into every port (plan invariant). No port is read twice, and
no figure is recomputed here beyond the pure arithmetic in `app/results/domain/`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.results.application.ports import (
    DebtorRow,
    DebtSummary,
    PaymentsReceived,
    PeriodExpenses,
    PeriodSales,
    StockFigures,
    StockRow,
)
from app.results.domain.arithmetic import average_sale, cash, profit
from app.results.domain.periods import Period, periods
from app.results.domain.sorting import oldest, sorted_by_name, teaser
from app.shared.grams import Grams


@dataclass(frozen=True)
class PeriodFigures:
    period: Period
    sales: int
    sales_count: int
    average_sale: int | None
    grams_sold: Grams
    grams_gifted: Grams
    cost_of_goods: int
    pending_cost: bool
    expenses: int
    purchases: int
    profit: int
    cash: int


@dataclass(frozen=True)
class DebtsSummary:
    total_owed: int
    sales_owing_count: int
    oldest: date | None
    teaser: tuple[DebtorRow, ...]


@dataclass(frozen=True)
class Panel:
    today: PeriodFigures
    week: PeriodFigures
    month: PeriodFigures
    debts: DebtsSummary
    stock: tuple[StockRow, ...]


def read_panel(
    today: date,
    sales: PeriodSales,
    stock: StockFigures,
    expenses: PeriodExpenses,
    received: PaymentsReceived,
    debts: DebtSummary,
) -> Panel:
    the_periods = periods(today)
    ordered = (the_periods.today, the_periods.week, the_periods.month)

    sales_summaries = sales.summaries(ordered)
    stock_answer = stock.read(today, ordered)
    expense_totals = expenses.totals(ordered)
    received_totals = received.totals(ordered)
    debts_answer = debts.read()

    def figures_for(period: Period) -> PeriodFigures:
        summary = sales_summaries[period]
        cost = stock_answer.cost_of_goods[period]
        spent = expense_totals[period]
        bought = stock_answer.purchases[period]
        collected = received_totals[period]
        return PeriodFigures(
            period=period,
            sales=summary.total,
            sales_count=summary.count,
            average_sale=average_sale(summary.total, summary.count),
            grams_sold=summary.grams_sold,
            grams_gifted=summary.grams_gifted,
            cost_of_goods=cost.amount,
            pending_cost=cost.pending,
            expenses=spent,
            purchases=bought,
            profit=profit(summary.total, cost.amount, spent),
            cash=cash(collected, spent, bought),
        )

    debts_summary = DebtsSummary(
        total_owed=debts_answer.total_owed,
        sales_owing_count=debts_answer.sales_owing_count,
        oldest=oldest(debts_answer.debtors),
        teaser=teaser(debts_answer.debtors),
    )

    return Panel(
        today=figures_for(the_periods.today),
        week=figures_for(the_periods.week),
        month=figures_for(the_periods.month),
        debts=debts_summary,
        stock=sorted_by_name(stock_answer.rows),
    )
