"""Análisis's one use case (ADR-0020, docs/product/analysis.md): resolves and
validates the chosen month, reads every ledger once through its port, and hands them
to `period_figures` — the one computation, never a second one."""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from app.results.application.ports import (
    DrawCosts,
    ExpensesLedger,
    PaymentsLedger,
    Purchases,
    SalesLedger,
)
from app.results.domain.figures import AnalysisFigures
from app.results.domain.period_figures import period_figures
from app.shared.calendar import Month


class AnalysisRuleBroken(ValueError):
    code: ClassVar[str] = "analysis.rule_broken"


class MonthInvalid(AnalysisRuleBroken):
    code: ClassVar[str] = "analysis.month_invalid"

    def __init__(self) -> None:
        super().__init__("a month is written YYYY-MM")


class MonthOutOfRange(AnalysisRuleBroken):
    code: ClassVar[str] = "analysis.month_out_of_range"

    def __init__(self) -> None:
        super().__init__("the chosen month is outside the business's history")


def analyse(
    draw_costs: DrawCosts,
    sales: SalesLedger,
    payments: PaymentsLedger,
    expenses: ExpensesLedger,
    purchases: Purchases,
    *,
    today: date,
    month: str | None,
) -> AnalysisFigures:
    try:
        requested = Month.containing(today) if month is None else Month.of(month)
    except ValueError:
        raise MonthInvalid() from None

    # One read of every ledger, one pass over each inside `period_figures` — which
    # works out `first_record` itself, in that same pass. The month is validated
    # against its answer below, never by a second scan of the same ledgers here.
    figures = period_figures(
        today=today,
        month=requested,
        draws=draw_costs.rows(),
        sales=sales.all(),
        payments=payments.all(),
        expenses=expenses.all(),
        purchases=purchases.purchases(),
        earliest_entry_day=purchases.earliest_entry_day(),
    )

    current_month = Month.containing(today)
    first_record = figures.first_record
    first_month = None if first_record is None else Month.containing(first_record)
    lower_bound = first_month if first_month is not None else current_month
    if requested < lower_bound or requested > current_month:
        raise MonthOutOfRange()

    return figures
