"""`GET /panel`'s HTTP shape (`web/src/api/fixtures/panel.json`, plan: "Answer
shape"). Adapters may import anything (CODING_STANDARDS section 1): `PanelVarietyOut`
reuses stock's own `VarietyStockOut` and `GramsOut`, rather than a second grams or
status format.

`GET /analysis`'s response shape (docs/adr/0020, plan: Response contract).

Pinned ahead of `period_figures` and the route so the front (`analysis-front`) and the
backend (`results-backend`) build against the same frozen contract. Bare (ADR-0005):
no length or pattern constraint, so a refusal is always the domain's, never pydantic's.

Money is `int`. Grams reuse `GramsOut` (`app/varieties/adapters/schemas.py`) rather than
a second float-serialising decimal. Percentages are `int | None`, never a float: this
file answers results figures (CODING_STANDARDS.md's "no float ... in any results money,
grams or percentage path"), it does not compute them.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.results.application.ports import DebtorRow, StockRow
from app.results.application.read_panel import DebtsSummary, Panel, PeriodFigures
from app.results.domain.setup import SetupView, Step
from app.stock.adapters.schemas import VarietyStockOut
from app.varieties.adapters.schemas import GramsOut


class PanelVarietyOut(VarietyStockOut):
    """`VarietyStockOut`'s own keys plus `name` (plan invariant: "`PanelVarietyOut`
    subclasses `VarietyStockOut` and adds only `name`")."""

    name: str

    @classmethod
    def of_row(cls, row: StockRow) -> PanelVarietyOut:
        # Not named `of`: `VarietyStockOut.of` takes a `VarietyStock` (stock's own
        # application view), and redeclaring `of` here with a different parameter
        # type would violate Liskov substitution on the inherited classmethod.
        return cls(
            variety_id=row.variety_id,
            name=row.name,
            grams=row.grams.as_decimal(),
            status=row.status,
            sold_out_since=row.sold_out_since,
            threshold=row.threshold.as_decimal() if row.threshold is not None else None,
            days_left=row.days_left,
        )


class DebtorOut(BaseModel):
    customer_id: int
    name: str
    balance: int
    owing_since: date

    @classmethod
    def of(cls, row: DebtorRow) -> DebtorOut:
        return cls(
            customer_id=row.customer_id,
            name=row.name,
            balance=row.balance,
            owing_since=row.owing_since,
        )


class DebtsOut(BaseModel):
    total_owed: int
    sales_owing_count: int
    oldest: date | None
    teaser: list[DebtorOut]

    @classmethod
    def of(cls, debts: DebtsSummary) -> DebtsOut:
        return cls(
            total_owed=debts.total_owed,
            sales_owing_count=debts.sales_owing_count,
            oldest=debts.oldest,
            teaser=[DebtorOut.of(row) for row in debts.teaser],
        )


class PeriodOut(BaseModel):
    start: date
    end: date
    sales: int
    sales_count: int
    average_sale: int | None
    grams_sold: GramsOut
    grams_gifted: GramsOut
    cost_of_goods: int
    pending_cost: bool
    expenses: int
    purchases: int
    profit: int
    cash: int

    @classmethod
    def of(cls, figures: PeriodFigures) -> PeriodOut:
        return cls(
            start=figures.period.start,
            end=figures.period.end,
            sales=figures.sales,
            sales_count=figures.sales_count,
            average_sale=figures.average_sale,
            grams_sold=figures.grams_sold.as_decimal(),
            grams_gifted=figures.grams_gifted.as_decimal(),
            cost_of_goods=figures.cost_of_goods,
            pending_cost=figures.pending_cost,
            expenses=figures.expenses,
            purchases=figures.purchases,
            profit=figures.profit,
            cash=figures.cash,
        )


class TodayFiguresOut(BaseModel):
    """Hoy carries only what it shows: the period and the sold-today figures. Ganancia,
    Caja, Gastos, Regalaste and Compras live in `week` and `month`."""

    start: date
    end: date
    sales: int
    sales_count: int
    grams_sold: GramsOut

    @classmethod
    def of(cls, figures: PeriodFigures) -> TodayFiguresOut:
        return cls(
            start=figures.period.start,
            end=figures.period.end,
            sales=figures.sales,
            sales_count=figures.sales_count,
            grams_sold=figures.grams_sold.as_decimal(),
        )


class PeriodsOut(BaseModel):
    today: TodayFiguresOut
    week: PeriodOut
    month: PeriodOut


class StepOut(BaseModel):
    step: Literal["priced_variety", "stock_entry", "bot_published", "partner"]
    done: bool
    required: bool

    @classmethod
    def of(cls, step: Step) -> StepOut:
        return cls(step=step.step, done=step.done, required=step.required)


class ChecklistOut(BaseModel):
    steps: list[StepOut]


class SetupOut(BaseModel):
    """Inicio's first-run state, every condition decided on the server (`setup_view`):
    the front renders the steps in this order and never filters or reorders them."""

    checklist: ChecklistOut | None
    priced_today: bool
    bot_notice: bool

    @classmethod
    def of(cls, view: SetupView) -> SetupOut:
        return cls(
            checklist=(
                None
                if view.checklist is None
                else ChecklistOut(steps=[StepOut.of(step) for step in view.checklist])
            ),
            priced_today=view.priced_today,
            bot_notice=view.bot_notice,
        )


class PanelOut(BaseModel):
    periods: PeriodsOut
    debts: DebtsOut
    stock: list[PanelVarietyOut]
    setup: SetupOut

    @classmethod
    def of(cls, panel: Panel) -> PanelOut:
        return cls(
            periods=PeriodsOut(
                today=TodayFiguresOut.of(panel.today),
                week=PeriodOut.of(panel.week),
                month=PeriodOut.of(panel.month),
            ),
            debts=DebtsOut.of(panel.debts),
            stock=[PanelVarietyOut.of_row(row) for row in panel.stock],
            setup=SetupOut.of(panel.setup),
        )


class MarginOut(BaseModel):
    """A margin in pesos, worked out over costed grams only (ADR-0020): a variety's own
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
    """Categories ordered by the stored `name_key`, as Gastos does (ADR-0020).
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
