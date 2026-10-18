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

The calendar (docs/adr/0043, GH-251): when `APOSTROPHE_E2E_CLOCK_OFFSET` (whole seconds) is
set, the app and the CLI calls below run on one advancing clock that started at `ANCHOR`,
so a run never depends on the date it happens on. `python -m tests.e2e_app offset` prints
the offset to hand to every worker; `invite-business` and `reset-password` are the accounts
command line under that same clock. Nothing but this module reads the variable.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI

from app.accounts.adapters import cli as accounts_cli
from app.clock import Clock, system_clock
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

# 2026-10-07 12:00 in Buenos Aires: the instant every e2e run starts from.
ANCHOR = datetime(2026, 10, 7, 15, 0, tzinfo=UTC)
CLOCK_OFFSET_VARIABLE = "APOSTROPHE_E2E_CLOCK_OFFSET"


def anchored_clock(offset: timedelta, source: Clock = system_clock) -> Clock:
    """A clock that reads `source` shifted by `offset`. It keeps advancing: a frozen clock
    would break the 15-minute brake windows (docs/adr/0043)."""

    def clock() -> datetime:
        return source() + offset

    return clock


def offset_seconds(source: Clock = system_clock) -> int:
    """Whole seconds from `source()` to `ANCHOR` (rounded up, so the clock starts at the
    anchor or less than a second after it), the offset `anchored_clock` takes."""
    return -((source() - ANCHOR) // timedelta(seconds=1))


def environment_clock() -> Clock:
    """The e2e clock: anchored when the offset variable is set, the real one otherwise."""
    raw = os.environ.get(CLOCK_OFFSET_VARIABLE)
    if not raw:
        return system_clock
    return anchored_clock(timedelta(seconds=int(raw)))


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
        Settings.from_env(), telegram=E2eTelegram(), upkeep_ticker=False, clock=environment_clock()
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


def main(argv: Sequence[str]) -> int:
    """`offset` | `invite-business` | `reset-password <email>`: the accounts command line
    (same stdout, stderr and exit code) on the e2e clock, plus the offset to give workers."""
    if list(argv) == ["offset"]:
        sys.stdout.write(f"{offset_seconds()}\n")
        return 0
    return accounts_cli.main(list(argv), clock=environment_clock())


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
