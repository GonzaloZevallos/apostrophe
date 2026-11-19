"""Análisis's one use case (ADR-0020, docs/product/analysis.md): resolves and
validates the chosen month, reads every ledger once through its port, and hands them
to `period_figures` — the one computation, never a second one. The one `StockFigures`
read answers both the draws `period_figures` costs and the What you have left list,
sorted the way `read_panel` sorts it."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import ClassVar

from app.results.application.ports import (
    ExpensesLedger,
    PaymentsLedger,
    Purchases,
    SalesLedger,
    StockFigures,
    StockRow,
    WithdrawalReasons,
)
from app.results.domain.figures import AnalysisFigures
from app.results.domain.period_figures import period_figures
from app.results.domain.sorting import sorted_by_name
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


@dataclass(frozen=True)
class Analysis:
    """The period figures plus What you have left as of today, never of the chosen month.
    `stock` is an application type: `StockRow` never enters the domain."""

    figures: AnalysisFigures
    stock: tuple[StockRow, ...]


def analyse(
    stock: StockFigures,
    sales: SalesLedger,
    payments: PaymentsLedger,
    expenses: ExpensesLedger,
    purchases: Purchases,
    reasons: WithdrawalReasons,
    *,
    today: date,
    month: str | None,
) -> Analysis:
    try:
        requested = Month.containing(today) if month is None else Month.of(month)
    except ValueError:
        raise MonthInvalid() from None

    answer = stock.read(today)

    # One read of every ledger, one pass over each inside `period_figures` — which
    # works out `first_record` itself, in that same pass. The month is validated
    # against its answer below, never by a second scan of the same ledgers here.
    figures = period_figures(
        today=today,
        month=requested,
        draws=answer.draws,
        sales=sales.all(),
        payments=payments.all(),
        expenses=expenses.all(),
        purchases=purchases.purchases(),
        earliest_entry_day=purchases.earliest_entry_day(),
        reasons=reasons.all(),
    )

    current_month = Month.containing(today)
    first_record = figures.first_record
    first_month = None if first_record is None else Month.containing(first_record)
    lower_bound = first_month if first_month is not None else current_month
    if requested < lower_bound or requested > current_month:
        raise MonthOutOfRange()

    return Analysis(figures=figures, stock=sorted_by_name(answer.rows))
