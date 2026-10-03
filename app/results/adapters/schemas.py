"""`GET /panel`'s HTTP shape (`web/src/api/fixtures/panel.json`, plan: "Answer
shape"). Adapters may import anything (CODING_STANDARDS section 1): `PanelVarietyOut`
reuses stock's own `VarietyStockOut` and `GramsOut`, rather than a second grams or
status format.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.results.application.ports import DebtorRow, StockRow
from app.results.application.read_panel import DebtsSummary, Panel, PeriodFigures
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


class PeriodsOut(BaseModel):
    today: PeriodOut
    week: PeriodOut
    month: PeriodOut


class PanelOut(BaseModel):
    periods: PeriodsOut
    debts: DebtsOut
    stock: list[PanelVarietyOut]

    @classmethod
    def of(cls, panel: Panel) -> PanelOut:
        return cls(
            periods=PeriodsOut(
                today=PeriodOut.of(panel.today),
                week=PeriodOut.of(panel.week),
                month=PeriodOut.of(panel.month),
            ),
            debts=DebtsOut.of(panel.debts),
            stock=[PanelVarietyOut.of_row(row) for row in panel.stock],
        )
