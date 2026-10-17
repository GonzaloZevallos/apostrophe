"""`/first-run` (docs/adr/0046): the first-run element of the session's own business, which
only ever comes from `CurrentBusinessId` (CODING_STANDARDS section 9). No request carries
a business, a figure or a name.

`GET` builds its whole answer first, with no write, and only then settles the stamps it
found due, once and in one commit. Settling is the one write a read makes, so it must
never change what the read answers: a database that cannot take the write
(`OperationalError`, and only that) is rolled back and logged by class name, and the
answer already built goes out as it was. Anything else propagates.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.onboarding.adapters.first_run_schemas import FirstRunOut
from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.application.dismiss_import_notice import dismiss_import_notice
from app.onboarding.application.ports import (
    BotFacts,
    CatalogFacts,
    StockFacts,
    UserFacts,
    VarietyFacts,
)
from app.onboarding.application.read_first_run import FirstRunSources, read_first_run
from app.onboarding.application.first_run import settle_first_run

router = APIRouter(prefix="/first-run", tags=["onboarding"])
logger = logging.getLogger("apostrophe.onboarding")

SessionDep = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]
TodayDep = Annotated[date, Depends(get_today)]


def get_first_runs(session: SessionDep, business_id: CurrentBusinessId) -> SqlFirstRuns:
    return SqlFirstRuns(session, business_id)


def get_sources(
    request: Request,
    session: SessionDep,
    business_id: CurrentBusinessId,
    today: TodayDep,
    first_runs: Annotated[SqlFirstRuns, Depends(get_first_runs)],
) -> FirstRunSources:
    # Starlette's `State` is untyped; `create_app` always assigns these five factories.
    state = request.app.state
    varieties = cast(Callable[[Session, int, date], VarietyFacts], state.onboarding_variety_facts)
    stock = cast(Callable[[Session, int], StockFacts], state.onboarding_stock_facts)
    bots = cast(Callable[[Session, int], BotFacts], state.onboarding_bot_facts)
    users = cast(Callable[[Session, int], UserFacts], state.onboarding_user_facts)
    catalog = cast(Callable[[Session, int, date], CatalogFacts], state.onboarding_catalog_facts)
    return FirstRunSources(
        onboardings=SqlOnboardings(session, business_id),
        first_runs=first_runs,
        varieties=varieties(session, business_id, today),
        stock=stock(session, business_id),
        bots=bots(session, business_id),
        users=users(session, business_id),
        catalog=catalog(session, business_id, today),
    )


FirstRunsDep = Annotated[SqlFirstRuns, Depends(get_first_runs)]
SourcesDep = Annotated[FirstRunSources, Depends(get_sources)]


@router.get("")
def get_first_run(
    sources: SourcesDep, first_runs: FirstRunsDep, session: SessionDep, clock: ClockDep
) -> FirstRunOut:
    read = read_first_run(sources)
    answer = FirstRunOut.of(read)
    if read.decision.due:
        try:
            settle_first_run(read.decision.due, clock(), first_runs, session)
        except OperationalError as exc:
            session.rollback()
            logger.warning("first run stamp failed: %s", type(exc).__name__)
    return answer


@router.post("/import-notice/dismissal", status_code=204)
def post_import_notice_dismissal(
    first_runs: FirstRunsDep, session: SessionDep, clock: ClockDep
) -> Response:
    dismiss_import_notice(first_runs, clock(), session)
    return Response(status_code=204)
