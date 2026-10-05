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

from fastapi import FastAPI

from app.main import create_app
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram


def create_e2e_app() -> FastAPI:
    return create_app(Settings.from_env(), telegram=FakeTelegram(), upkeep_ticker=False)
