"""`GET /panel`: no path, query or body parameter (plan invariant). It reads
`get_today` once and builds each of the five owner ports from its own
`app.state` factory over the request's `Session` and business — the same shape
`app/sales/adapters/router.py` already uses for `line_costs` and `owing_sales`.

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

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.results.adapters.assemble import assemble
from app.results.adapters.schemas import AnalysisOut, PanelOut
from app.results.application.analyse import AnalysisRuleBroken, analyse
from app.results.application.dismiss_bot_notice import dismiss_bot_notice
from app.results.application.ports import (
    BusinessUsers,
    CatalogPublishing,
    DebtSummary,
    DrawCosts,
    ExpensesLedger,
    PaymentsLedger,
    PaymentsReceived,
    PeriodExpenses,
    PeriodSales,
    PricedVarieties,
    Purchases,
    SalesLedger,
    SetupStateStore,
    StockFigures,
)
from app.results.application.read_panel import SetupPorts, read_panel

router = APIRouter(tags=["results"])

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]


def get_period_sales(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PeriodSales:
    factory = cast(Callable[[Session, int], PeriodSales], request.app.state.period_sales)
    return factory(session, business_id)


def get_stock_figures(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> StockFigures:
    factory = cast(Callable[[Session, int], StockFigures], request.app.state.stock_figures)
    return factory(session, business_id)


def get_period_expenses(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PeriodExpenses:
    factory = cast(Callable[[Session, int], PeriodExpenses], request.app.state.period_expenses)
    return factory(session, business_id)


def get_payments_received(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PaymentsReceived:
    factory = cast(
        Callable[[Session, int], PaymentsReceived], request.app.state.payments_received
    )
    return factory(session, business_id)


def get_debt_summary(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> DebtSummary:
    factory = cast(Callable[[Session, int], DebtSummary], request.app.state.debt_summary)
    return factory(session, business_id)


PeriodSalesDep = Annotated[PeriodSales, Depends(get_period_sales)]
StockFiguresDep = Annotated[StockFigures, Depends(get_stock_figures)]
PeriodExpensesDep = Annotated[PeriodExpenses, Depends(get_period_expenses)]
PaymentsReceivedDep = Annotated[PaymentsReceived, Depends(get_payments_received)]
DebtSummaryDep = Annotated[DebtSummary, Depends(get_debt_summary)]


def get_setup_state_store(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> SetupStateStore:
    factory = cast(Callable[[Session, int], SetupStateStore], request.app.state.setup_state_store)
    return factory(session, business_id)


def get_priced_varieties(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> PricedVarieties:
    factory = cast(Callable[[Session, int], PricedVarieties], request.app.state.priced_varieties)
    return factory(session, business_id)


def get_business_users(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> BusinessUsers:
    factory = cast(Callable[[Session, int], BusinessUsers], request.app.state.business_users)
    return factory(session, business_id)


def get_catalog_publishing(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> CatalogPublishing:
    factory = cast(
        Callable[[Session, int], CatalogPublishing], request.app.state.catalog_publishing
    )
    return factory(session, business_id)


SetupStateStoreDep = Annotated[SetupStateStore, Depends(get_setup_state_store)]
PricedVarietiesDep = Annotated[PricedVarieties, Depends(get_priced_varieties)]
BusinessUsersDep = Annotated[BusinessUsers, Depends(get_business_users)]
CatalogPublishingDep = Annotated[CatalogPublishing, Depends(get_catalog_publishing)]
ClockDep = Annotated[Clock, Depends(get_clock)]


@router.get("/panel")
def get_panel(
    today: TodayDep,
    clock: ClockDep,
    session: SessionDep,
    sales: PeriodSalesDep,
    stock: StockFiguresDep,
    expenses: PeriodExpensesDep,
    received: PaymentsReceivedDep,
    debts: DebtSummaryDep,
    store: SetupStateStoreDep,
    priced: PricedVarietiesDep,
    users: BusinessUsersDep,
    publishing: CatalogPublishingDep,
) -> PanelOut:
    panel = read_panel(
        today,
        clock(),
        sales,
        stock,
        expenses,
        received,
        debts,
        SetupPorts(store=store, priced=priced, users=users, publishing=publishing),
        session,
    )
    return PanelOut.of(panel)


@router.post("/panel/bot-notice/dismissal", status_code=204)
def dismiss_the_bot_notice(
    store: SetupStateStoreDep, session: SessionDep, clock: ClockDep
) -> Response:
    dismiss_bot_notice(store, session, clock())
    return Response(status_code=204)


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


DrawCostsDep = Annotated[DrawCosts, Depends(get_draw_costs)]
SalesLedgerDep = Annotated[SalesLedger, Depends(get_sales_ledger)]
PaymentsLedgerDep = Annotated[PaymentsLedger, Depends(get_payments_ledger)]
ExpensesLedgerDep = Annotated[ExpensesLedger, Depends(get_expenses_ledger)]
PurchasesDep = Annotated[Purchases, Depends(get_purchases)]

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
