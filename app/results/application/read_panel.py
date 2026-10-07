"""The panel's one use case (ADR-0013, amendment GH-70): composes stock's rows and
draws, every ledger `analyse` already reads, and debts into one answer. `scan` runs
once over the business's whole history; Hoy, the week and the month each read their
own figures back through `totals_between` — the same computation `GET /analysis` uses
for its weeks, months and since-first-record (ADR-0020) — so Inicio's Ganancia and
Caja can no longer disagree with Análisis's for the same period. No figure here is a
second sum of its own.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.results.application.ports import (
    DebtorRow,
    DebtSummary,
    ExpensesLedger,
    PaymentsLedger,
    Purchases,
    SalesLedger,
    StockFigures,
    StockRow,
)
from app.results.domain.arithmetic import average_sale
from app.results.domain.figures import AmountWithPending
from app.results.domain.period_figures import scan, totals_between
from app.results.domain.periods import Period, periods
from app.results.domain.sorting import oldest, sorted_by_name, teaser
from app.shared.grams import Grams


@dataclass(frozen=True)
class CostLineFigures:
    """The panel's own shape for a cost line (stock shortfall, promotion, own use): an
    amount and one pending flag, decided from that line's own pending grams (plan
    invariant) — no grams cross the wire (PM)."""

    amount: int
    pending: bool


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
    shortfall: CostLineFigures | None
    promotion: CostLineFigures | None
    own_use: CostLineFigures | None
    expenses: int
    purchases: int
    profit: int
    profit_pending: bool
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


def _cost_line(figure: AmountWithPending | None) -> CostLineFigures | None:
    return (
        None
        if figure is None
        else CostLineFigures(amount=figure.amount, pending=figure.pending_grams.hundredths > 0)
    )


def read_panel(
    today: date,
    stock: StockFigures,
    sales: SalesLedger,
    payments: PaymentsLedger,
    expenses: ExpensesLedger,
    purchases: Purchases,
    debts: DebtSummary,
) -> Panel:
    the_periods = periods(today)
    stock_answer = stock.read(today)
    buckets, _ = scan(
        draws=stock_answer.draws,
        sales=sales.all(),
        payments=payments.all(),
        expenses=expenses.all(),
        purchases=purchases.purchases(),
        earliest_entry_day=purchases.earliest_entry_day(),
    )

    def figures_for(period: Period) -> PeriodFigures:
        totals = totals_between(buckets, period.start, period.end)
        return PeriodFigures(
            period=period,
            sales=totals.sales,
            sales_count=totals.sales_count,
            average_sale=average_sale(totals.sales, totals.sales_count),
            grams_sold=totals.grams_sold,
            grams_gifted=totals.grams_gifted,
            cost_of_goods=totals.cost_of_goods.costed,
            pending_cost=totals.cost_of_goods.pending_grams.hundredths > 0,
            shortfall=_cost_line(totals.shortfall),
            promotion=_cost_line(totals.promotion),
            own_use=_cost_line(totals.own_use),
            expenses=totals.expenses,
            purchases=totals.purchases,
            profit=totals.profit.amount,
            profit_pending=totals.profit.pending_grams.hundredths > 0,
            cash=totals.cash,
        )

    debts_answer = debts.read()
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
