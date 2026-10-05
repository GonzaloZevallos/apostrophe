"""Turns `period_figures`'s domain result into `AnalysisOut` (ADR-0020). The only
place `AnalysisFigures` becomes JSON; the schemas themselves stay exactly as
`analysis-contract` pinned them."""

from __future__ import annotations

from datetime import date

from app.results.adapters.schemas import (
    AmountWithPendingOut,
    AnalysisMonthOut,
    AnalysisOut,
    CostOut,
    ExpenseBreakdownOut,
    ExpenseCategoryTotalOut,
    MarginOut,
    MonthRowOut,
    SinceFirstRecordOut,
    VarietyRowOut,
    WeekdayOut,
    WeekOut,
)
from app.results.domain.figures import (
    AmountWithPending,
    AnalysisFigures,
    CostFigure,
    ExpenseBreakdown,
    MarginFigure,
)


def _margin(figure: MarginFigure) -> MarginOut:
    return MarginOut(
        amount=figure.amount,
        percent=figure.percent,
        pending_grams=figure.pending_grams.as_decimal(),
    )


def _cost(figure: CostFigure) -> CostOut:
    return CostOut(costed=figure.costed, pending_grams=figure.pending_grams.as_decimal())


def _amount_with_pending(figure: AmountWithPending) -> AmountWithPendingOut:
    return AmountWithPendingOut(
        amount=figure.amount, pending_grams=figure.pending_grams.as_decimal()
    )


def _shortfall(figure: AmountWithPending | None) -> AmountWithPendingOut | None:
    return None if figure is None else _amount_with_pending(figure)


def _breakdown(breakdown: ExpenseBreakdown) -> ExpenseBreakdownOut:
    return ExpenseBreakdownOut(
        categories=[
            ExpenseCategoryTotalOut(category_id=c.category_id, name=c.name, total=c.total)
            for c in breakdown.categories
        ],
        total=breakdown.total,
        purchases=breakdown.purchases,
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
            sales=month.sales,
            sales_without_shipping=month.sales_without_shipping,
            grams_sold=month.grams_sold.as_decimal(),
            grams_gifted=month.grams_gifted.as_decimal(),
            average_margin=_margin(month.average_margin),
            shortfall=_shortfall(month.shortfall),
            varieties=[
                VarietyRowOut(
                    variety_id=v.variety_id,
                    name=v.name,
                    sales_without_shipping=v.sales_without_shipping,
                    share_percent=v.share_percent,
                    grams_sold=v.grams_sold.as_decimal(),
                    grams_gifted=v.grams_gifted.as_decimal(),
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
                sales=w.sales,
                grams=w.grams.as_decimal(),
                expenses=w.expenses,
                profit=_amount_with_pending(w.profit),
                cash=w.cash,
                best=w.best,
            )
            for w in figures.weeks
        ],
        months=[
            MonthRowOut(
                month=str(m.month),
                first_day=m.first_day,
                last_day=m.last_day,
                sales=m.sales,
                grams=m.grams.as_decimal(),
                expenses=m.expenses,
                profit=_amount_with_pending(m.profit),
                cash=m.cash,
            )
            for m in figures.months
        ],
        weekdays=[
            WeekdayOut(weekday=w.weekday, sales=w.sales, count=w.count, best=w.best)
            for w in figures.weekdays
        ],
        since_first_record=(
            None
            if since is None
            else SinceFirstRecordOut(
                sales=since.sales,
                expenses=since.expenses,
                profit=_amount_with_pending(since.profit),
                cash=since.cash,
                shortfall=_shortfall(since.shortfall),
            )
        ),
        month_expenses=_breakdown(figures.month_expenses),
        since_first_record_expenses=_breakdown(figures.since_first_record_expenses),
    )
