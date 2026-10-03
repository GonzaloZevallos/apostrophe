"""`GET /panel`: no path, query or body parameter (plan invariant). It reads
`get_today` once and builds each of the five owner ports from its own
`app.state` factory over the request's `Session` and business — the same shape
`app/sales/adapters/router.py` already uses for `line_costs` and `owing_sales`.
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
from app.results.adapters.schemas import PanelOut
from app.results.application.ports import (
    DebtSummary,
    PaymentsReceived,
    PeriodExpenses,
    PeriodSales,
    StockFigures,
)
from app.results.application.read_panel import read_panel

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


@router.get("/panel")
def get_panel(
    today: TodayDep,
    sales: PeriodSalesDep,
    stock: StockFiguresDep,
    expenses: PeriodExpensesDep,
    received: PaymentsReceivedDep,
    debts: DebtSummaryDep,
) -> PanelOut:
    panel = read_panel(today, sales, stock, expenses, received, debts)
    return PanelOut.of(panel)
