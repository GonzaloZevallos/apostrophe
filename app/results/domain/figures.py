"""What `period_figures` answers (ADR-0020, CONTEXT.md: Margin, Margin percentage,
Average margin, Stock shortfall, Best week, Best weekday). Plain, frozen value
objects; the adapter schemas (`app/results/adapters/schemas.py`) are the only place
these turn into JSON."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.shared.calendar import Month
from app.shared.quantity import Quantity


@dataclass(frozen=True)
class MarginFigure:
    """A margin in pesos, worked out over costed grams only. `percent` is `None` when
    the sales it is taken over are $0; `pending_quantity` is the sold-or-gifted grams
    behind it that are not costed yet."""

    amount: int
    percent: int | None
    pending_quantity: Quantity


@dataclass(frozen=True)
class CostFigure:
    costed: int
    pending_quantity: Quantity


@dataclass(frozen=True)
class AmountWithPending:
    """A money figure (profit) together with the pending grams behind it, for one
    period."""

    amount: int
    pending_quantity: Quantity


@dataclass(frozen=True)
class RowCost:
    """One Análisis cost line (cost of goods or stock shortfall):
    its costed amount, its own pending grams and whether *every* gram behind it is
    pending, so the screen reads "N g sin costo" and never "$ 0". `row_cost` in
    `period_figures` is the only place `all_pending` is decided."""

    amount: int
    pending_quantity: Quantity
    all_pending: bool

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError("a cost line's amount cannot be negative")
        if self.pending_quantity.hundredths < 0:
            raise ValueError("a cost line's pending grams cannot be negative")
        if self.all_pending and not self.pending_quantity.is_positive:
            raise ValueError("a fully pending cost line has pending grams")


@dataclass(frozen=True)
class ReasonCost:
    """One withdrawal reason's cost over a window: its costed `amount`, `None` exactly
    when every gram withdrawn under it is still pending (so no screen reads "$ 0"), its
    own `pending_quantity` and `pending`, whether that is positive. `period_figures` is
    the only place one is built, in the list order of the business's reasons."""

    reason_id: int
    name: str
    amount: int | None
    pending_quantity: Quantity
    pending: bool

    def __post_init__(self) -> None:
        if self.amount is not None and self.amount < 0:
            raise ValueError("a reason's cost cannot be negative")
        if self.amount is None and not self.pending:
            raise ValueError("a reason with no costed amount is fully pending")
        if self.pending != self.pending_quantity.is_positive:
            raise ValueError("pending is exactly whether pending grams are positive")


@dataclass(frozen=True)
class VarietyRow:
    variety_id: int
    name: str
    sales_without_shipping: int
    share_percent: int | None
    quantity_sold: Quantity
    quantity_gifted: Quantity
    cost: CostFigure
    margin: MarginFigure


@dataclass(frozen=True)
class MonthFigures:
    month: Month
    previous: Month | None
    next: Month | None
    sales: int
    sales_without_shipping: int
    quantity_sold: Quantity
    quantity_gifted: Quantity
    average_margin: MarginFigure
    shortfall: RowCost | None
    withdrawals: tuple[ReasonCost, ...]
    varieties: tuple[VarietyRow, ...]


@dataclass(frozen=True)
class WeekFigures:
    first_day: date
    last_day: date
    sales: int
    quantity: Quantity
    expenses: int
    cost_of_goods: RowCost
    shortfall: RowCost | None
    withdrawals: tuple[ReasonCost, ...]
    profit: AmountWithPending
    cash: int
    best: bool


@dataclass(frozen=True)
class MonthRowFigures:
    month: Month
    first_day: date
    last_day: date
    sales: int
    quantity: Quantity
    expenses: int
    cost_of_goods: RowCost
    shortfall: RowCost | None
    withdrawals: tuple[ReasonCost, ...]
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
    shortfall: RowCost | None
    withdrawals: tuple[ReasonCost, ...]


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
    quantity_sold: Quantity
    quantity_gifted: Quantity
    cost_of_goods: CostFigure
    cost_of_goods_row: RowCost
    shortfall: RowCost | None
    withdrawals: tuple[ReasonCost, ...]
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
