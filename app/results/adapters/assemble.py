"""Turns `period_figures`'s domain result into `AnalysisOut` (ADR-0020). The only
place `AnalysisFigures` becomes JSON; the schemas themselves stay exactly as
`analysis-contract` pinned them."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.results.adapters.schemas import (
    AmountWithPendingOut,
    AnalysisMonthOut,
    AnalysisOut,
    CostOut,
    ExpenseBreakdownOut,
    ExpenseCategoryTotalOut,
    MarginOut,
    MonthRowOut,
    ProductRowOut,
    RowCostOut,
    SinceFirstRecordOut,
    WeekdayOut,
    WeekOut,
    reason_costs,
)
from app.results.domain.figures import (
    AmountWithPending,
    AnalysisFigures,
    CostFigure,
    ExpenseBreakdown,
    MarginFigure,
    RowCost,
)


def _margin(figure: MarginFigure) -> MarginOut:
    return MarginOut(
        amount=Decimal(figure.amount),
        percent=figure.percent,
        pending_quantity=figure.pending_quantity.as_decimal(),
    )


def _cost(figure: CostFigure) -> CostOut:
    return CostOut(
        costed=Decimal(figure.costed), pending_quantity=figure.pending_quantity.as_decimal()
    )


def _amount_with_pending(figure: AmountWithPending) -> AmountWithPendingOut:
    return AmountWithPendingOut(
        amount=Decimal(figure.amount), pending_quantity=figure.pending_quantity.as_decimal()
    )


def _row_cost(figure: RowCost) -> RowCostOut:
    """Copies `all_pending`; only `row_cost` in the domain decides it."""
    return RowCostOut(
        amount=Decimal(figure.amount),
        pending_quantity=figure.pending_quantity.as_decimal(),
        all_pending=figure.all_pending,
    )


def _optional(figure: RowCost | None) -> RowCostOut | None:
    return None if figure is None else _row_cost(figure)


def _breakdown(breakdown: ExpenseBreakdown) -> ExpenseBreakdownOut:
    return ExpenseBreakdownOut(
        categories=[
            ExpenseCategoryTotalOut(category_id=c.category_id, name=c.name, total=Decimal(c.total))
            for c in breakdown.categories
        ],
        total=Decimal(breakdown.total),
        purchases=Decimal(breakdown.purchases),
    )


def assemble(today: date, figures: AnalysisFigures) -> AnalysisOut:
    month = figures.month
    since = figures.since_first_record
    return AnalysisOut(
        today=today,
        first_record=figures.first_record,
        month=AnalysisMonthOut(
            month=str(month.month),
            previous=None if month.previous is None else str(month.previous),
            next=None if month.next is None else str(month.next),
            sales=Decimal(month.sales),
            sales_without_shipping=Decimal(month.sales_without_shipping),
            quantity_sold=month.quantity_sold.as_decimal(),
            quantity_gifted=month.quantity_gifted.as_decimal(),
            average_margin=_margin(month.average_margin),
            shortfall=_optional(month.shortfall),
            withdrawals=reason_costs(month.withdrawals),
            products=[
                ProductRowOut(
                    product_id=v.variety_id,
                    name=v.name,
                    sales_without_shipping=Decimal(v.sales_without_shipping),
                    share_percent=v.share_percent,
                    quantity_sold=v.quantity_sold.as_decimal(),
                    quantity_gifted=v.quantity_gifted.as_decimal(),
                    cost=_cost(v.cost),
                    margin=_margin(v.margin),
                )
                for v in month.varieties
            ],
        ),
        weeks=[
            WeekOut(
                first_day=w.first_day,
                last_day=w.last_day,
                sales=Decimal(w.sales),
                quantity=w.quantity.as_decimal(),
                cost_of_goods=_row_cost(w.cost_of_goods),
                shortfall=_optional(w.shortfall),
                withdrawals=reason_costs(w.withdrawals),
                expenses=Decimal(w.expenses),
                profit=_amount_with_pending(w.profit),
                cash=Decimal(w.cash),
                best=w.best,
            )
            for w in figures.weeks
        ],
        months=[
            MonthRowOut(
                month=str(m.month),
                first_day=m.first_day,
                last_day=m.last_day,
                sales=Decimal(m.sales),
                quantity=m.quantity.as_decimal(),
                cost_of_goods=_row_cost(m.cost_of_goods),
                shortfall=_optional(m.shortfall),
                withdrawals=reason_costs(m.withdrawals),
                expenses=Decimal(m.expenses),
                profit=_amount_with_pending(m.profit),
                cash=Decimal(m.cash),
            )
            for m in figures.months
        ],
        weekdays=[
            WeekdayOut(weekday=w.weekday, sales=Decimal(w.sales), count=w.count, best=w.best)
            for w in figures.weekdays
        ],
        since_first_record=(
            None
            if since is None
            else SinceFirstRecordOut(
                sales=Decimal(since.sales),
                expenses=Decimal(since.expenses),
                profit=_amount_with_pending(since.profit),
                cash=Decimal(since.cash),
                shortfall=_optional(since.shortfall),
                withdrawals=reason_costs(since.withdrawals),
            )
        ),
        month_expenses=_breakdown(figures.month_expenses),
        since_first_record_expenses=_breakdown(figures.since_first_record_expenses),
    )
