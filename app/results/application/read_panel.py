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
from datetime import date, datetime, timedelta, tzinfo

from app.results.application.ports import (
    DebtorRow,
    DebtSummary,
    ExpensesLedger,
    PaymentMethods,
    PaymentsLedger,
    Purchases,
    SalesLedger,
    StockFigures,
    StockRow,
    WithdrawalReasons,
)
from app.results.domain.arithmetic import average_sale
from app.results.domain.figures import AmountWithPending, PeriodTotals, ReasonCost, RowCost
from app.results.domain.period_figures import scan, totals_between
from app.results.domain.periods import Period, periods
from app.results.domain.sorting import oldest, sorted_by_name, teaser
from app.results.domain.today_ordering import BestSeller, LowStock, best_sellers, low_stock
from app.results.domain.today_series import (
    LAST_HOUR,
    DaySales,
    MoneyIn,
    change_percent,
    hourly_running_total,
    last_7_days,
    money_in,
    so_far,
)
from app.shared.calendar import local_day
from app.shared.quantity import Quantity


@dataclass(frozen=True)
class CostLineFigures:
    """The panel's own shape for the stock shortfall line: an amount and one pending
    flag, decided from that line's own pending grams (plan invariant) — no grams cross
    the wire (PM). A withdrawal reason's line is a `ReasonCost`, passed through as it
    is."""

    amount: int
    pending: bool


@dataclass(frozen=True)
class PeriodFigures:
    period: Period
    sales: int
    sales_count: int
    average_sale: int | None
    quantity_sold: Quantity
    quantity_gifted: Quantity
    cost_of_goods: int
    pending_cost: bool
    shortfall: CostLineFigures | None
    withdrawals: tuple[ReasonCost, ...]
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
class TodayFigures:
    """Today's block: `sales` and `sales_count` are `periods.today`'s own totals; the
    so-far pair is cut at the same local time of day, to the second. `hourly_today` runs
    from hour 0 to the current hour and `hourly_last_week` through hour 23."""

    sales: int
    sales_count: int
    so_far: int
    last_week_so_far: int
    last_week_day: date
    change_percent: int | None
    hourly_today: tuple[int, ...]
    hourly_last_week: tuple[int, ...]
    last_7_days: tuple[DaySales, ...]
    money_in: MoneyIn
    low_stock: LowStock[StockRow]
    best_sellers: tuple[BestSeller, ...]
    month_profit: AmountWithPending


@dataclass(frozen=True)
class Panel:
    today: PeriodFigures
    week: PeriodFigures
    month: PeriodFigures
    debts: DebtsSummary
    stock: tuple[StockRow, ...]
    today_block: TodayFigures


def _cost_line(figure: RowCost | None) -> CostLineFigures | None:
    return (
        None
        if figure is None
        else CostLineFigures(amount=figure.amount, pending=figure.pending_quantity.hundredths > 0)
    )


def read_panel(
    now: datetime,
    tz: tzinfo,
    stock: StockFigures,
    sales: SalesLedger,
    payments: PaymentsLedger,
    expenses: ExpensesLedger,
    purchases: Purchases,
    debts: DebtSummary,
    reasons: WithdrawalReasons,
    methods: PaymentMethods,
) -> Panel:
    now_local = now.astimezone(tz)
    today = local_day(now, tz)
    last_week_day = today - timedelta(days=7)
    cut = now_local.time().replace(tzinfo=None, microsecond=0)
    through_hour = now_local.hour
    the_periods = periods(today)
    stock_answer = stock.read(today)
    all_sales = sales.all()
    buckets, _ = scan(
        draws=stock_answer.draws,
        sales=all_sales,
        payments=payments.all(),
        expenses=expenses.all(),
        purchases=purchases.purchases(),
        earliest_entry_day=purchases.earliest_entry_day(),
        reasons=reasons.all(),
    )

    def figures_of(period: Period, totals: PeriodTotals) -> PeriodFigures:
        return PeriodFigures(
            period=period,
            sales=totals.sales,
            sales_count=totals.sales_count,
            average_sale=average_sale(totals.sales, totals.sales_count),
            quantity_sold=totals.quantity_sold,
            quantity_gifted=totals.quantity_gifted,
            cost_of_goods=totals.cost_of_goods.costed,
            pending_cost=totals.cost_of_goods.pending_quantity.hundredths > 0,
            shortfall=_cost_line(totals.shortfall),
            withdrawals=totals.withdrawals,
            expenses=totals.expenses,
            purchases=totals.purchases,
            profit=totals.profit.amount,
            profit_pending=totals.profit.pending_quantity.hundredths > 0,
            cash=totals.cash,
        )

    def figures_for(period: Period) -> PeriodFigures:
        return figures_of(period, totals_between(buckets, period.start, period.end))

    debts_answer = debts.read(today)
    debts_summary = DebtsSummary(
        total_owed=debts_answer.total_owed,
        sales_owing_count=debts_answer.sales_owing_count,
        oldest=oldest(debts_answer.debtors),
        teaser=teaser(debts_answer.debtors),
    )

    today_figures = figures_for(the_periods.today)
    # One `totals_between` for the month: its Profit and the Month figures are one result.
    month_totals = totals_between(buckets, the_periods.month.start, the_periods.month.end)
    compared = [sale for sale in all_sales if sale.day in (today, last_week_day)]
    today_so_far = so_far(compared, today, cut, tz)
    last_week_so_far = so_far(compared, last_week_day, cut, tz)
    today_block = TodayFigures(
        sales=today_figures.sales,
        sales_count=today_figures.sales_count,
        so_far=today_so_far,
        last_week_so_far=last_week_so_far,
        last_week_day=last_week_day,
        change_percent=change_percent(today_so_far, last_week_so_far),
        hourly_today=hourly_running_total(compared, today, tz, through_hour=through_hour),
        hourly_last_week=hourly_running_total(compared, last_week_day, tz, through_hour=LAST_HOUR),
        last_7_days=last_7_days(buckets, today),
        money_in=money_in(buckets, methods.all(), today),
        low_stock=low_stock(stock_answer.rows),
        best_sellers=best_sellers(stock_answer.draws, the_periods.week.start, today),
        month_profit=month_totals.profit,
    )

    return Panel(
        today=today_figures,
        week=figures_for(the_periods.week),
        month=figures_of(the_periods.month, month_totals),
        debts=debts_summary,
        stock=sorted_by_name(stock_answer.rows),
        today_block=today_block,
    )
