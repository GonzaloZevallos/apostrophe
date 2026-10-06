"""The e2e app factory for the pinned-catalog front (plan, "Front", "End to end"):
`web/playwright.config.ts`'s `webServer` runs this with `uvicorn --factory`, the same
way `scripts/serve.sh` runs `app.main:create_app`, except `telegram` is always
`tests.fakes.telegram.FakeTelegram` (here its `E2eTelegram` subclass) — the plan's invariant
that no test but `test_telegram_http.py` ever constructs the real adapter holds for the e2e
run too — and `upkeep_ticker` is off, so no background sync races the run's own timing.

`Settings.from_env()` reads the same environment variables `create_app` would read on
its own (`APOSTROPHE_SECRET_KEY`, `APOSTROPHE_DATABASE_URL`, ...), so
`web/e2e/env.ts`'s `e2eEnv()` is the one source of truth for both this module and the
`invite-business` CLI call `web/e2e/backend.ts` makes.
"""

from __future__ import annotations

from collections.abc import Sequence

from fastapi import FastAPI

from app.main import create_app
from app.pinned_catalog.domain.errors import SendRefusal, TelegramRefused
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram

# The one person who pressed Iniciar on the e2e bot: Buscar mi chat finds this number, and
# only a send to it (or to a channel `@name`) is accepted, as Telegram forbids a bot to
# write first to anyone else.
E2E_STARTED_CHAT = "111111"


class E2eTelegram(FakeTelegram):
    """`FakeTelegram` that behaves like a bot with exactly one started private chat, so the
    e2e run can go from "Abrí tu bot en Telegram y tocá Iniciar" to a successful Probarlo
    using only what the screen says."""

    def send(self, token: str, chat: str, plain: str, spans: Sequence[tuple[int, int]]) -> int:
        if not chat.startswith("@") and chat != E2E_STARTED_CHAT:
            raise TelegramRefused(SendRefusal.CHAT_NOT_STARTED)
        return super().send(token, chat, plain, spans)

    def private_chats(self, token: str) -> frozenset[str]:
        return frozenset({E2E_STARTED_CHAT})


def create_e2e_app() -> FastAPI:
    return create_app(Settings.from_env(), telegram=E2eTelegram(), upkeep_ticker=False)
