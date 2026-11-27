from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import get_today
from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.application.ports import Balances
from app.db import get_session
from app.products.adapters.sql_products import SqlProducts
from app.search.adapters.name_search import EmptySaleSearch, SqlCustomerSearch, SqlProductSearch
from app.search.adapters.schemas import SearchOut
from app.search.application.search import search
from app.search.domain.query import SearchQuery
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals

router = APIRouter(tags=["search"])

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]


def get_balances(request: Request, session: SessionDep, business_id: CurrentBusinessId) -> Balances:
    # Search never imports `app.payments`: `app/main.py` hangs the real implementation on
    # `app.state.balances` as a factory, as the customers router reads it.
    factory = cast(Callable[[Session, int], Balances], request.app.state.balances)
    return factory(session, business_id)


BalancesDep = Annotated[Balances, Depends(get_balances)]


# FastAPI binds the last value of a repeated scalar query parameter, so `?q=ab&q=cd` is
# `cd`.
@router.get("/search")
def grouped_search(
    session: SessionDep,
    business_id: CurrentBusinessId,
    balances: BalancesDep,
    today: TodayDep,
    q: str = "",
) -> SearchOut:
    result = search(
        SearchQuery.of(q),
        EmptySaleSearch(),
        SqlCustomerSearch(SqlCustomers(session, business_id), balances),
        SqlProductSearch(
            SqlProducts(session, business_id),
            SqlStockEntries(session, business_id),
            SqlDraws(session, business_id),
            SqlStockWithdrawals(session, business_id),
            today,
        ),
    )
    return SearchOut.of(result)
