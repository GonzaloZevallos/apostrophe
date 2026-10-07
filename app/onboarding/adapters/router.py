"""`/onboarding-progress` (docs/adr/0035): the Onboarding's one answer, read and written
for the session's own business only, which only ever comes from `CurrentBusinessId`
(CODING_STANDARDS section 9). The only request input is the pass body's `step` and `as`.

The Onboarding reaches every owner's facts only through its own ports: `app/main.py`
hangs each real implementation on `app.state` as a factory, and this router builds them
over the request's `Session` and business. `GET` never writes; every write answers the
same shape a `GET` does, and commits once, inside its use case.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.onboarding.adapters.schemas import STEP_BY_SLUG, PassIn, ProgressOut
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.application import use_cases
from app.onboarding.application.facts import FactSources
from app.onboarding.application.ports import BotFacts, StockFacts, UserFacts, VarietyFacts
from app.onboarding.domain.errors import OnboardingNotFound, RequiredStepsUnmet, StepInvalid

router = APIRouter(prefix="/onboarding-progress", tags=["onboarding"])

SessionDep = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]
TodayDep = Annotated[date, Depends(get_today)]

as_http = TranslateErrors(
    [
        (404, (OnboardingNotFound,)),
        (409, (RequiredStepsUnmet,)),
        (422, (StepInvalid,)),
    ]
)


def get_onboardings(session: SessionDep, business_id: CurrentBusinessId) -> SqlOnboardings:
    return SqlOnboardings(session, business_id)


def get_fact_sources(
    request: Request, session: SessionDep, business_id: CurrentBusinessId, today: TodayDep
) -> FactSources:
    # Starlette's `State` is untyped; `create_app` always assigns these four factories.
    state = request.app.state
    varieties = cast(Callable[[Session, int, date], VarietyFacts], state.onboarding_variety_facts)
    stock = cast(Callable[[Session, int], StockFacts], state.onboarding_stock_facts)
    bots = cast(Callable[[Session, int], BotFacts], state.onboarding_bot_facts)
    users = cast(Callable[[Session, int], UserFacts], state.onboarding_user_facts)
    return FactSources(
        varieties=varieties(session, business_id, today),
        stock=stock(session, business_id),
        bots=bots(session, business_id),
        users=users(session, business_id),
    )


OnboardingsDep = Annotated[SqlOnboardings, Depends(get_onboardings)]
SourcesDep = Annotated[FactSources, Depends(get_fact_sources)]


@router.get("")
def get_progress(onboardings: OnboardingsDep, sources: SourcesDep) -> ProgressOut:
    return ProgressOut.of(use_cases.read_progress(onboardings, sources))


@router.post("/passes")
def post_pass(
    body: PassIn,
    onboardings: OnboardingsDep,
    sources: SourcesDep,
    session: SessionDep,
    clock: ClockDep,
) -> ProgressOut:
    with as_http:
        step = STEP_BY_SLUG.get(body.step)
        if step is None:
            raise StepInvalid
        progress = use_cases.record_pass(
            onboardings, sources, session, clock(), int(step), body.as_
        )
        return ProgressOut.of(progress)


@router.post("/skip-rest")
def post_skip_rest(
    onboardings: OnboardingsDep, sources: SourcesDep, session: SessionDep, clock: ClockDep
) -> ProgressOut:
    with as_http:
        return ProgressOut.of(use_cases.skip_rest(onboardings, sources, session, clock()))


@router.post("/advance")
def post_advance(
    onboardings: OnboardingsDep, sources: SourcesDep, session: SessionDep, clock: ClockDep
) -> ProgressOut:
    with as_http:
        return ProgressOut.of(use_cases.advance(onboardings, sources, session, clock()))
