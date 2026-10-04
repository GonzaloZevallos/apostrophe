"""`GET /analysis`'s response shape (docs/adr/0013, plan: Response contract).

Pinned ahead of `period_figures` and the route so the front (`analysis-front`) and the
backend (`results-backend`) build against the same frozen contract. Bare (ADR-0005):
no length or pattern constraint, so a refusal is always the domain's, never pydantic's.

Money is `int`. Grams reuse `GramsOut` (`app/varieties/adapters/schemas.py`) rather than
a second float-serialising decimal. Percentages are `int | None`, never a float: this
file answers results figures (CODING_STANDARDS.md's "no float ... in any results money,
grams or percentage path"), it does not compute them.
"""

from datetime import date

from pydantic import BaseModel

from app.varieties.adapters.schemas import GramsOut


class MarginOut(BaseModel):
    """A margin in pesos, worked out over costed grams only (ADR-0013): a variety's own
    margin, or the chosen month's average margin. `percent` is `null` when the sales it
    is taken over are $0; `pending_grams` is the sold-or-gifted grams behind it that are
    not costed yet."""

    amount: int
    percent: int | None
    pending_grams: GramsOut


class CostOut(BaseModel):
    costed: int
    pending_grams: GramsOut


class AmountWithPendingOut(BaseModel):
    """A money figure (profit, or stock shortfall) together with the pending grams
    behind it, for one period."""

    amount: int
    pending_grams: GramsOut


class VarietyRowOut(BaseModel):
    variety_id: int
    name: str
    sales_without_shipping: int
    share_percent: int | None
    grams_sold: GramsOut
    grams_gifted: GramsOut
    cost: CostOut
    margin: MarginOut


class AnalysisMonthOut(BaseModel):
    month: str
    previous: str | None
    next: str | None
    sales: int
    sales_without_shipping: int
    grams_sold: GramsOut
    grams_gifted: GramsOut
    average_margin: MarginOut
    shortfall: AmountWithPendingOut | None
    varieties: list[VarietyRowOut]


class WeekOut(BaseModel):
    first_day: date
    last_day: date
    sales: int
    grams: GramsOut
    expenses: int
    profit: AmountWithPendingOut
    cash: int
    best: bool


class MonthRowOut(BaseModel):
    month: str
    first_day: date
    last_day: date
    sales: int
    grams: GramsOut
    expenses: int
    profit: AmountWithPendingOut
    cash: int


class WeekdayOut(BaseModel):
    weekday: int
    sales: int
    count: int
    best: bool


class SinceFirstRecordOut(BaseModel):
    sales: int
    expenses: int
    profit: AmountWithPendingOut
    cash: int
    shortfall: AmountWithPendingOut | None


class ExpenseCategoryTotalOut(BaseModel):
    category_id: int
    name: str
    total: int


class ExpenseBreakdownOut(BaseModel):
    """Categories ordered by the stored `name_key`, as Gastos does (ADR-0013).
    `purchases` is always present, $0 included, and never counted inside `total`."""

    categories: list[ExpenseCategoryTotalOut]
    total: int
    purchases: int


class AnalysisOut(BaseModel):
    today: date
    first_record: date | None
    month: AnalysisMonthOut
    weeks: list[WeekOut]
    months: list[MonthRowOut]
    weekdays: list[WeekdayOut]
    since_first_record: SinceFirstRecordOut | None
    month_expenses: ExpenseBreakdownOut
    since_first_record_expenses: ExpenseBreakdownOut
