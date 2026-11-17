"""`GET /panel`'s HTTP shape (`web/src/api/fixtures/panel.json`, plan: "Answer
shape"). Adapters may import anything (CODING_STANDARDS section 1): `PanelProductOut`
reuses stock's own `Status` and `QuantityOut`, rather than a second quantity or
status format.

`GET /analysis`'s response shape (docs/adr/0020, plan: Response contract).

Pinned ahead of `period_figures` and the route so the front (`analysis-front`) and the
backend (`results-backend`) build against the same frozen contract. Bare (ADR-0005):
no length or pattern constraint, so a refusal is always the domain's, never pydantic's.

Money is `MoneyOut`: the value in currency units, an integer on the wire while it is whole
(docs/adr/0058). Quantity reuse `QuantityOut` (`app/products/adapters/schemas.py`) rather than
a second float-serialising decimal. Percentages are `int | None`, never a float: this
file answers results figures (CODING_STANDARDS.md's "no float ... in any results money,
grams or percentage path"), it does not compute them.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.money_schema import MoneyOut
from app.products.adapters.schemas import QuantityOut
from app.results.application.ports import DebtorRow, StockRow
from app.results.application.read_panel import CostLineFigures, DebtsSummary, Panel, PeriodFigures
from app.results.domain.figures import ReasonCost
from app.stock.adapters.schemas import Status


class PanelProductOut(BaseModel):
    """The keys of stock's `ProductStockOut` plus `name`; the row's internal id is mapped to
    `product_id` here, in the adapter."""

    product_id: int
    quantity: QuantityOut
    status: Status
    sold_out_since: date | None
    threshold: QuantityOut | None
    days_left: int | None
    name: str

    @classmethod
    def of_row(cls, row: StockRow) -> PanelProductOut:
        return cls(
            product_id=row.variety_id,
            name=row.name,
            quantity=row.quantity.as_decimal(),
            status=row.status,
            sold_out_since=row.sold_out_since,
            threshold=row.threshold.as_decimal() if row.threshold is not None else None,
            days_left=row.days_left,
        )


class DebtorOut(BaseModel):
    customer_id: int
    name: str
    balance: MoneyOut
    owing_since: date

    @classmethod
    def of(cls, row: DebtorRow) -> DebtorOut:
        return cls(
            customer_id=row.customer_id,
            name=row.name,
            balance=Decimal(row.balance),
            owing_since=row.owing_since,
        )


class DebtsOut(BaseModel):
    total_owed: MoneyOut
    sales_owing_count: int
    oldest: date | None
    teaser: list[DebtorOut]

    @classmethod
    def of(cls, debts: DebtsSummary) -> DebtsOut:
        return cls(
            total_owed=Decimal(debts.total_owed),
            sales_owing_count=debts.sales_owing_count,
            oldest=debts.oldest,
            teaser=[DebtorOut.of(row) for row in debts.teaser],
        )


class CostLineOut(BaseModel):
    """A period's stock shortfall cost (CONTEXT.md), `null`
    exactly when the period has none of that line's records. `pending` is decided from
    that line's own pending grams (plan invariant); no grams cross the wire (PM)."""

    amount: MoneyOut
    pending: bool

    @classmethod
    def of(cls, line: CostLineFigures | None) -> CostLineOut | None:
        return None if line is None else cls(amount=Decimal(line.amount), pending=line.pending)


class ReasonCostOut(BaseModel):
    """One withdrawal reason's cost line, in the list order `period_figures` answered
    it: Home's Week, Month and Today and every Análisis row serialise it through here
    and nowhere else. `amount` is `null` when every gram is pending, never 0."""

    reason_id: int
    name: str
    amount: MoneyOut | None
    pending: bool
    pending_quantity: QuantityOut

    @classmethod
    def from_domain(cls, cost: ReasonCost) -> ReasonCostOut:
        return cls(
            reason_id=cost.reason_id,
            name=cost.name,
            amount=None if cost.amount is None else Decimal(cost.amount),
            pending=cost.pending,
            pending_quantity=cost.pending_quantity.as_decimal(),
        )


def reason_costs(costs: tuple[ReasonCost, ...]) -> list[ReasonCostOut]:
    return [ReasonCostOut.from_domain(cost) for cost in costs]


class PeriodOut(BaseModel):
    start: date
    end: date
    sales: MoneyOut
    sales_count: int
    average_sale: MoneyOut | None
    quantity_sold: QuantityOut
    quantity_gifted: QuantityOut
    cost_of_goods: MoneyOut
    pending_cost: bool
    shortfall: CostLineOut | None
    withdrawals: list[ReasonCostOut]
    expenses: MoneyOut
    purchases: MoneyOut
    profit: MoneyOut
    profit_pending: bool
    cash: MoneyOut

    @classmethod
    def of(cls, figures: PeriodFigures) -> PeriodOut:
        return cls(
            start=figures.period.start,
            end=figures.period.end,
            sales=Decimal(figures.sales),
            sales_count=figures.sales_count,
            average_sale=(None if figures.average_sale is None else Decimal(figures.average_sale)),
            quantity_sold=figures.quantity_sold.as_decimal(),
            quantity_gifted=figures.quantity_gifted.as_decimal(),
            cost_of_goods=Decimal(figures.cost_of_goods),
            pending_cost=figures.pending_cost,
            shortfall=CostLineOut.of(figures.shortfall),
            withdrawals=reason_costs(figures.withdrawals),
            expenses=Decimal(figures.expenses),
            purchases=Decimal(figures.purchases),
            profit=Decimal(figures.profit),
            profit_pending=figures.profit_pending,
            cash=Decimal(figures.cash),
        )


class PeriodsOut(BaseModel):
    today: PeriodOut
    week: PeriodOut
    month: PeriodOut


class PanelOut(BaseModel):
    periods: PeriodsOut
    debts: DebtsOut
    stock: list[PanelProductOut]

    @classmethod
    def of(cls, panel: Panel) -> PanelOut:
        return cls(
            periods=PeriodsOut(
                today=PeriodOut.of(panel.today),
                week=PeriodOut.of(panel.week),
                month=PeriodOut.of(panel.month),
            ),
            debts=DebtsOut.of(panel.debts),
            stock=[PanelProductOut.of_row(row) for row in panel.stock],
        )


class MarginOut(BaseModel):
    """A margin in pesos, worked out over costed grams only (ADR-0020): a product's own
    margin, or the chosen month's average margin. `percent` is `null` when the sales it
    is taken over are $0; `pending_quantity` is the sold-or-gifted grams behind it that are
    not costed yet."""

    amount: MoneyOut
    percent: int | None
    pending_quantity: QuantityOut


class CostOut(BaseModel):
    costed: MoneyOut
    pending_quantity: QuantityOut


class AmountWithPendingOut(BaseModel):
    """A money figure (profit) together with the pending grams behind it, for one
    period."""

    amount: MoneyOut
    pending_quantity: QuantityOut


class RowCostOut(BaseModel):
    """One Análisis cost line (cost of goods or stock shortfall): its
    costed `amount` and its own `pending_quantity` (a positive magnitude). `all_pending` is
    the domain's answer (`row_cost`) that every gram behind the line is pending, so the
    screen says "N g sin costo" and never "$ 0"."""

    amount: MoneyOut
    pending_quantity: QuantityOut
    all_pending: bool


class ProductRowOut(BaseModel):
    product_id: int
    name: str
    sales_without_shipping: MoneyOut
    share_percent: int | None
    quantity_sold: QuantityOut
    quantity_gifted: QuantityOut
    cost: CostOut
    margin: MarginOut


class AnalysisMonthOut(BaseModel):
    month: str
    previous: str | None
    next: str | None
    sales: MoneyOut
    sales_without_shipping: MoneyOut
    quantity_sold: QuantityOut
    quantity_gifted: QuantityOut
    average_margin: MarginOut
    shortfall: RowCostOut | None
    withdrawals: list[ReasonCostOut]
    products: list[ProductRowOut]


class WeekOut(BaseModel):
    first_day: date
    last_day: date
    sales: MoneyOut
    quantity: QuantityOut
    cost_of_goods: RowCostOut
    shortfall: RowCostOut | None
    withdrawals: list[ReasonCostOut]
    expenses: MoneyOut
    profit: AmountWithPendingOut
    cash: MoneyOut
    best: bool


class MonthRowOut(BaseModel):
    month: str
    first_day: date
    last_day: date
    sales: MoneyOut
    quantity: QuantityOut
    cost_of_goods: RowCostOut
    shortfall: RowCostOut | None
    withdrawals: list[ReasonCostOut]
    expenses: MoneyOut
    profit: AmountWithPendingOut
    cash: MoneyOut


class WeekdayOut(BaseModel):
    weekday: int
    sales: MoneyOut
    count: int
    best: bool


class SinceFirstRecordOut(BaseModel):
    sales: MoneyOut
    expenses: MoneyOut
    profit: AmountWithPendingOut
    cash: MoneyOut
    shortfall: RowCostOut | None
    withdrawals: list[ReasonCostOut]


class ExpenseCategoryTotalOut(BaseModel):
    category_id: int
    name: str
    total: MoneyOut


class ExpenseBreakdownOut(BaseModel):
    """Categories ordered by the stored `name_key`, as Gastos does (ADR-0020).
    `purchases` is always present, $0 included, and never counted inside `total`."""

    categories: list[ExpenseCategoryTotalOut]
    total: MoneyOut
    purchases: MoneyOut


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
