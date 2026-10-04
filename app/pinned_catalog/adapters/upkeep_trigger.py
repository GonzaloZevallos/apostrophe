"""The post-commit upkeep trigger (plan, "Triggers" / ADR-0014): a `BackgroundTasks`
task added only for `POST`, `PUT`, `PATCH` and `DELETE`, so it starts only once a
request is already being answered — never on the triggering write's own session, never
before its commit. `app/main.py` adds this dependency to exactly the varieties, stock,
sales and catalog routers; no use case and no other hexagon changes for it.

A refused write answers through an exception handler before a `Response` is ever
produced, so this task is simply dropped — nothing changed, so nothing to sync.
"""

from __future__ import annotations

from typing import cast

from fastapi import BackgroundTasks, Request

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, business_day
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def schedule_upkeep(
    request: Request, background_tasks: BackgroundTasks, business_id: CurrentBusinessId
) -> None:
    if request.method not in _WRITE_METHODS:
        return
    clock = cast(Clock, request.app.state.clock)
    today = business_day(clock())
    background_tasks.add_task(run_upkeep_safely, request.app.state, business_id, today)
