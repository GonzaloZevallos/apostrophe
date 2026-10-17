"""The e2e app factory for the pinned-catalog front (plan, "Front", "End to end"):
`web/e2e/fixtures.ts`'s `workerServer` fixture runs this, once per Playwright worker, with
`uvicorn --factory`, the same
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

import os
import threading
import time
from collections.abc import Callable, Sequence

from fastapi import FastAPI

from app.clock import system_clock
from app.main import create_app
from app.pinned_catalog.domain.errors import SendRefusal, TelegramRefused
from app.settings import Settings
from tests.fakes.telegram import FakeTelegram

# The one person who pressed Iniciar on the e2e bot: Buscar mi chat finds this number, and
# only a send to it (or to a channel `@name`) is accepted, as Telegram forbids a bot to
# write first to anyone else.
E2E_STARTED_CHAT = "111111"


# The thread `create_e2e_app` starts when `APOSTROPHE_E2E_PARENT_PID` is set (GH-152).
WATCHER_THREAD_NAME = "e2e-parent-watcher"
_PARENT_PID_VARIABLE = "APOSTROPHE_E2E_PARENT_PID"
_WATCH_INTERVAL_SECONDS = 1.0


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


def parent_gone(pid: int, kill: Callable[[int, int], None] = os.kill) -> bool:
    """Whether process `pid` no longer exists: signal 0 delivers nothing, it only checks.
    A process that exists but is not ours to signal is alive."""
    try:
        kill(pid, 0)
    except ProcessLookupError:
        return True
    except PermissionError:
        return False
    return False


def watch_parent(
    pid: int,
    *,
    gone: Callable[[int], bool],
    exit: Callable[[int], object],
    interval: float,
    sleep: Callable[[float], object],
) -> None:
    """Ends this server once its Playwright worker `pid` is gone, so a crashed worker never
    leaves a uvicorn alive (ADR-0040)."""
    while not gone(pid):
        sleep(interval)
    exit(0)


def create_e2e_app() -> FastAPI:
    app = create_app(
        Settings.from_env(), clock=system_clock, telegram=E2eTelegram(), upkeep_ticker=False
    )
    parent = os.environ.get(_PARENT_PID_VARIABLE)
    if parent:
        threading.Thread(
            target=watch_parent,
            args=(int(parent),),
            kwargs={
                "gone": parent_gone,
                "exit": os._exit,
                "interval": _WATCH_INTERVAL_SECONDS,
                "sleep": time.sleep,
            },
            name=WATCHER_THREAD_NAME,
            daemon=True,
        ).start()
    return app
