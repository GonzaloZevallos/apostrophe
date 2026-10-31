"""The day-change ticker (plan, "Day change" / ADR-0014): calls `sync_all_published`
once at startup and then every 300 seconds, off the event loop (`asyncio.to_thread`),
catching everything per tick so one bad tick never stops the next. `app/main.py`'s
`lifespan` starts it only when `app.state.pinned_catalog_upkeep_ticker` is true, and
cancels it on shutdown (plan's "Process model": correct only because
`scripts/serve.sh` runs a single process).
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import cast

from sqlalchemy.engine import Engine
from starlette.datastructures import State

from app.clock import Clock
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely
from app.pinned_catalog.adapters.sql_due import SqlDueBusinesses
from app.pinned_catalog.application.ports import BusinessZones
from app.pinned_catalog.application.sync_all import sync_all_published

INTERVAL_SECONDS = 300.0


def _tick(state: State, instant: datetime) -> None:
    due = SqlDueBusinesses(cast(Engine, state.engine), cast(BusinessZones, state.business_zones))
    sync_all_published(
        instant, due, lambda business_id: run_upkeep_safely(state, business_id, instant)
    )


async def run_ticker(state: State) -> None:
    clock = cast(Clock, state.clock)
    while True:
        try:
            await asyncio.to_thread(_tick, state, clock())
        except Exception:
            # `run_upkeep_safely` already contains every per-business failure; this is
            # only a backstop against the due-businesses query itself failing, so one
            # bad tick never stops the next (the plan's own "catching everything per
            # tick"). It carries nothing to log beyond what `run_upkeep_safely` already
            # logs per business.
            pass
        await asyncio.sleep(INTERVAL_SECONDS)
