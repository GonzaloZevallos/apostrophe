"""The e2e app factory for the pinned-catalog front (plan, "Front", "End to end"):
`web/playwright.config.ts`'s `webServer` runs this with `uvicorn --factory`, the same
way `scripts/serve.sh` runs `app.main:create_app`, except `telegram` is always
`tests.fakes.telegram.FakeTelegram` — the plan's invariant that no test but
`test_telegram_http.py` ever constructs the real adapter holds for the e2e run too —
and `upkeep_ticker` is off, so no background sync races the run's own timing.

`Settings.from_env()` reads the same environment variables `create_app` would read on
its own (`APOSTROPHE_SECRET_KEY`, `APOSTROPHE_DATABASE_URL`, ...), so
`web/e2e/env.ts`'s `e2eEnv()` is the one source of truth for both this module and the
`invite-business` CLI call `web/e2e/backend.ts` makes.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import FastAPI

from app.main import create_app
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram


def create_e2e_app() -> FastAPI:
    return create_app(Settings.from_env(), telegram=FakeTelegram(), upkeep_ticker=False)


# The phone check's second server (GH-80, invariant 7): its clock answers this one instant
# on every call, so the business day, the week and the month never move under the walk
# and the offender lists stay true. The front's clock is pinned to the same instant.
PINNED_INSTANT = datetime(2026, 9, 16, 12, 0, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))


def create_mobile_e2e_app() -> FastAPI:
    return create_app(
        Settings.from_env(),
        clock=lambda: PINNED_INSTANT,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
