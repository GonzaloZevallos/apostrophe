"""`run_upkeep_safely` (plan, "The wrapper" / ADR-0014): the only caller of
`push(..., "upkeep")` off the request path. It contains every exception per business,
tries once to record `telegram_unreachable` through `push.py`'s own
`record_unreachable` (swallowing a second failure rather than letting the sync's own
bookkeeping fail loudly), and logs exactly one fixed WARNING line naming only the
exception's class — no business id, chat, token or text (CODING_STANDARDS section 9),
the product's first emitted log line (section 7).
"""

from __future__ import annotations

import logging
from datetime import date
from typing import cast

from sqlalchemy.engine import Engine
from starlette.datastructures import State

from app.clock import Clock
from app.pinned_catalog.adapters.sql_recorder import SqlPinRecorder
from app.pinned_catalog.adapters.sql_snapshot import SqlPinSnapshots
from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.application.ports import Telegram
from app.pinned_catalog.application.push import BusinessLocks, push, record_unreachable

logger = logging.getLogger("apostrophe.pinned_catalog")


def run_upkeep_safely(state: State, business_id: int, today: date) -> None:
    engine = cast(Engine, state.engine)
    cipher = cast(TokenCipher, state.pinned_catalog_cipher)
    telegram = cast(Telegram, state.pinned_catalog_telegram)
    locks = cast(BusinessLocks, state.pinned_catalog_locks)
    clock = cast(Clock, state.clock)
    snapshots = SqlPinSnapshots(engine, cipher)
    recorder = SqlPinRecorder(engine)
    try:
        push(telegram, snapshots, recorder, locks, business_id, "upkeep", today, clock())
    except Exception as exc:
        logger.warning("pinned catalog sync failed: %s", type(exc).__name__)
        try:
            record_unreachable(snapshots, recorder, locks, business_id, today)
        except Exception:
            pass  # the bookkeeping attempt itself failed; the WARNING above still fired
