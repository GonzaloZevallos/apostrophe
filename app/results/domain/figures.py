"""What `period_figures` answers (ADR-0020, CONTEXT.md: Margin, Margin percentage,
Average margin, Stock shortfall, Best week, Best weekday). Plain, frozen value
objects; the adapter schemas (`app/results/adapters/schemas.py`) are the only place
these turn into JSON."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.shared.calendar import Month
from app.shared.grams import Grams


@dataclass(frozen=True)
class MarginFigure:
    """A margin in pesos, worked out over costed grams only. `percent` is `None` when
    the sales it is taken over are $0; `pending_grams` is the sold-or-gifted grams
    behind it that are not costed yet."""

    amount: int
    percent: int | None
    pending_grams: Grams


_ZERO = Grams(0)


@dataclass(frozen=True)
class CostAmount:
    """A cost line (stock shortfall, promotion, own use) over one period: the costed
    amount, the grams not costed yet and the grams that were costed. `costed_grams` is
    accumulated only in `period_figures.scan` (ADR-0020 amendment GH-141)."""

    amount: int
    pending_grams: Grams
    costed_grams: Grams

    @property
    def all_pending(self) -> bool:
        """Entirely pending: pending grams exist and none of the draws was costed. Never
        decided from `amount == 0` (a lot with no recorded cost costs $0)."""
        return self.costed_grams == _ZERO and self.pending_grams > _ZERO


@dataclass(frozen=True)
class CostFigure:
    costed: int
    pending_grams: Grams
    costed_grams: Grams

    @property
    def all_pending(self) -> bool:
        """See `CostAmount.all_pending`: the only author of the flag."""
        return self.costed_grams == _ZERO and self.pending_grams > _ZERO


@dataclass(frozen=True)
class AmountWithPending:
    """A money figure (profit, or stock shortfall) together with the pending grams
    behind it, for one period."""

    amount: int
    pending_grams: Grams


@dataclass(frozen=True)
class VarietyRow:
    variety_id: int
    name: str
    sales_without_shipping: int
    share_percent: int | None
    grams_sold: Grams
    grams_gifted: Grams
    cost: CostFigure
    margin: MarginFigure


@dataclass(frozen=True)
class MonthFigures:
    month: Month
    previous: Month | None
    next: Month | None
    sales: int
    sales_without_shipping: int
    grams_sold: Grams
    grams_gifted: Grams
    average_margin: MarginFigure
    shortfall: CostAmount | None
    promotion: CostAmount | None
    own_use: CostAmount | None
    varieties: tuple[VarietyRow, ...]


@dataclass(frozen=True)
class WeekFigures:
    first_day: date
    last_day: date
    sales: int
    grams: Grams
    expenses: int
    cost_of_goods: CostFigure
    shortfall: CostAmount | None
    promotion: CostAmount | None
    own_use: CostAmount | None
    profit: AmountWithPending
    cash: int
    best: bool


@dataclass(frozen=True)
class MonthRowFigures:
    month: Month
    first_day: date
    last_day: date
    sales: int
    grams: Grams
    expenses: int
    cost_of_goods: CostFigure
    shortfall: CostAmount | None
    promotion: CostAmount | None
    own_use: CostAmount | None
    profit: AmountWithPending
    cash: int


@dataclass(frozen=True)
class WeekdayFigures:
    weekday: int
    sales: int
    count: int
    best: bool


@dataclass(frozen=True)
class SinceFirstRecordFigures:
    sales: int
    expenses: int
    profit: AmountWithPending
    cash: int
    shortfall: CostAmount | None
    promotion: CostAmount | None
    own_use: CostAmount | None


@dataclass(frozen=True)
class ExpenseCategoryTotal:
    category_id: int
    name: str
    total: int


@dataclass(frozen=True)
class ExpenseBreakdown:
    categories: tuple[ExpenseCategoryTotal, ...]
    total: int
    purchases: int


@dataclass(frozen=True)
class PeriodTotals:
    """One `[start, end]` window's figures, answered by `period_figures.totals_between`
    over a `scan`ned `Buckets` (ADR-0013 amendment GH-70, ADR-0020): Inicio's panel and
    Análisis's weeks/months/since-first-record all read the same computation through
    here, never a second sum of their own."""

    sales: int
    sales_count: int
    grams_sold: Grams
    grams_gifted: Grams
    cost_of_goods: CostFigure
    shortfall: CostAmount | None
    promotion: CostAmount | None
    own_use: CostAmount | None
    expenses: int
    purchases: int
    profit: AmountWithPending
    cash: int


@dataclass(frozen=True)
class AnalysisFigures:
    first_record: date | None
    month: MonthFigures
    weeks: tuple[WeekFigures, ...]
    months: tuple[MonthRowFigures, ...]
    weekdays: tuple[WeekdayFigures, ...]
    since_first_record: SinceFirstRecordFigures | None
    month_expenses: ExpenseBreakdown
    since_first_record_expenses: ExpenseBreakdown
