"""`GET /panel`: no path, query or body parameter (plan invariant; ADR-0013 amendment
GH-70). It reads `get_today` once and builds `StockFigures`, the same `SalesLedger`,
`PaymentsLedger`, `ExpensesLedger` and `Purchases` ports `GET /analysis` uses, and
`DebtSummary`, each from its own `app.state` factory over the request's `Session` and
business — the same shape `app/sales/adapters/router.py` already uses for
`line_costs` and `owing_sales`.

`GET /analysis` (ADR-0020, docs/product/analysis.md). Gated; the business comes
only from the session, never the request (CODING_STANDARDS section 9).

Results never imports `app.stock`, `app.sales`, `app.payments` or `app.expenses`
adapters directly (the same shape `LineCosts`/`Balances`/`OwingSales` already use):
`app/main.py` hangs each real implementation on `app.state` as a factory
(`Callable[[Session, int], Port]`), and this router reaches it only through its own
port, by `Depends`.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.results.adapters.assemble import assemble
from app.results.adapters.schemas import AnalysisOut, PanelOut
from app.results.application.analyse import AnalysisRuleBroken, analyse
from app.results.application.ports import (
    DebtSummary,
    DrawCosts,
    ExpensesLedger,
    PaymentsLedger,
    Purchases,
    SalesLedger,
    StockFigures,
)
from app.results.application.read_panel import read_panel

router = APIRouter(tags=["results"])

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]


def get_stock_figures(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> StockFigures:
    factory = cast(Callable[[Session, int], StockFigures], request.app.state.stock_figures)
    return factory(session, business_id)


def get_debt_summary(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> DebtSummary:
    factory = cast(Callable[[Session, int], DebtSummary], request.app.state.debt_summary)
    return factory(session, business_id)


def get_draw_costs(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> DrawCosts:
    factory = cast(Callable[[Session, int], DrawCosts], request.app.state.draw_costs)
    return factory(session, business_id)


def get_sales_ledger(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> SalesLedger:
    factory = cast(Callable[[Session, int], SalesLedger], request.app.state.sales_ledger)
    return factory(session, business_id)


def get_payments_ledger(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PaymentsLedger:
    factory = cast(Callable[[Session, int], PaymentsLedger], request.app.state.payments_ledger)
    return factory(session, business_id)


def get_expenses_ledger(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> ExpensesLedger:
    factory = cast(Callable[[Session, int], ExpensesLedger], request.app.state.expenses_ledger)
    return factory(session, business_id)


def get_purchases(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> Purchases:
    factory = cast(Callable[[Session, int], Purchases], request.app.state.purchases_ledger)
    return factory(session, business_id)


StockFiguresDep = Annotated[StockFigures, Depends(get_stock_figures)]
DebtSummaryDep = Annotated[DebtSummary, Depends(get_debt_summary)]
DrawCostsDep = Annotated[DrawCosts, Depends(get_draw_costs)]
SalesLedgerDep = Annotated[SalesLedger, Depends(get_sales_ledger)]
PaymentsLedgerDep = Annotated[PaymentsLedger, Depends(get_payments_ledger)]
ExpensesLedgerDep = Annotated[ExpensesLedger, Depends(get_expenses_ledger)]
PurchasesDep = Annotated[Purchases, Depends(get_purchases)]


@router.get("/panel")
def get_panel(
    today: TodayDep,
    stock: StockFiguresDep,
    sales: SalesLedgerDep,
    payments: PaymentsLedgerDep,
    expenses: ExpensesLedgerDep,
    purchases: PurchasesDep,
    debts: DebtSummaryDep,
) -> PanelOut:
    panel = read_panel(today, stock, sales, payments, expenses, purchases, debts)
    return PanelOut.of(panel)


as_http = TranslateErrors([(422, (AnalysisRuleBroken,))])


@router.get("/analysis")
def get_analysis(
    draw_costs: DrawCostsDep,
    sales: SalesLedgerDep,
    payments: PaymentsLedgerDep,
    expenses: ExpensesLedgerDep,
    purchases: PurchasesDep,
    today: TodayDep,
    month: str | None = None,
) -> AnalysisOut:
    with as_http:
        figures = analyse(
            draw_costs, sales, payments, expenses, purchases, today=today, month=month
        )
        return assemble(today, figures)
