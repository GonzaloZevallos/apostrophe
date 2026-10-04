"""`GET /analysis` (ADR-0013, docs/product/analysis.md). Gated; the business comes
only from the session, never the request (CODING_STANDARDS section 9)."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import get_today
from app.db import get_session
from app.expenses.adapters.expenses_ledger import SqlExpensesLedger
from app.http_errors import TranslateErrors
from app.payments.adapters.payments_ledger import SqlPaymentsLedger
from app.results.adapters.assemble import assemble
from app.results.adapters.schemas import AnalysisOut
from app.results.application.analyse import AnalysisRuleBroken, analyse
from app.sales.adapters.sales_ledger import SqlSalesLedger
from app.stock.adapters.draw_costs import SqlDrawCosts
from app.stock.adapters.purchases import SqlPurchases

router = APIRouter(tags=["results"])

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]

as_http = TranslateErrors([(422, (AnalysisRuleBroken,))])


@router.get("/analysis")
def get_analysis(
    session: SessionDep,
    business_id: CurrentBusinessId,
    today: TodayDep,
    month: str | None = None,
) -> AnalysisOut:
    with as_http:
        figures = analyse(
            SqlDrawCosts(session, business_id),
            SqlSalesLedger(session, business_id),
            SqlPaymentsLedger(session, business_id),
            SqlExpensesLedger(session, business_id),
            SqlPurchases(session, business_id),
            today=today,
            month=month,
        )
        return assemble(today, figures)
