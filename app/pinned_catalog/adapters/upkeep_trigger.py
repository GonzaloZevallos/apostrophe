"""The post-commit upkeep trigger (plan, "Triggers" / ADR-0014): a `BackgroundTasks`
task added only for `POST`, `PUT`, `PATCH` and `DELETE`, so it starts only once a
request is already being answered — never on the triggering write's own session, never
before its commit. `app/main.py` adds this dependency to exactly the varieties, stock,
sales and catalog routers; no use case and no other hexagon changes for it.

A refused write answers through an exception handler before a `Response` is ever
produced, so this task is simply dropped — nothing changed, so nothing to sync.

The task first closes the request's own `Session` (the one `get_session` caches for the
request, shared with `require_session` and the router): FastAPI closes a yield dependency
only after the background tasks have run, so without this the request's connection would
stay checked out through the whole upkeep and starve the pool. Every use case has already
committed before the response, so the close drops nothing.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, cast

from fastapi import BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session
from starlette.datastructures import State

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, business_day
from app.db import get_session
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _release_then_upkeep(
    session: Session, state: State, business_id: CurrentBusinessId, today: date
) -> None:
    session.close()
    run_upkeep_safely(state, business_id, today)


def schedule_upkeep(
    request: Request,
    background_tasks: BackgroundTasks,
    business_id: CurrentBusinessId,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    if request.method not in _WRITE_METHODS:
        return
    clock = cast(Clock, request.app.state.clock)
    today = business_day(clock())
    background_tasks.add_task(
        _release_then_upkeep, session, cast(State, request.app.state), business_id, today
    )
