"""`run_upkeep_safely` (plan, "The wrapper" / ADR-0014): the only caller of
`push(..., "upkeep")` off the request path. It contains every exception per business,
tries once to record `telegram_unreachable` through `push.py`'s own
`record_unreachable` (swallowing a second failure rather than letting the sync's own
bookkeeping fail loudly), and logs exactly one fixed WARNING line naming only the
exception's class — no business id, chat, token or text (CODING_STANDARDS section 9),
the product's first emitted log line (section 7).

It reads the committed zone of the business itself and works out its own today from the
instant it is given (ADR-0057). A zone that cannot be loaded makes it do nothing for
that business, and `last_checked_on` is not written.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime
from typing import cast
from zoneinfo import ZoneInfo

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from starlette.datastructures import State

from app.catalog.application.ports import (
    CatalogLanguage,
    CatalogPricingSettings,
    CatalogWordsSource,
)
from app.clock import Clock
from app.pinned_catalog.adapters.sql_recorder import SqlPinRecorder
from app.pinned_catalog.adapters.sql_snapshot import SqlPinSnapshots
from app.pinned_catalog.adapters.telegram_holder import PinnedCatalogTelegram
from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.application.ports import BusinessZone
from app.pinned_catalog.application.push import BusinessLocks, push, record_unreachable
from app.shared.calendar import business_day, load_zone

logger = logging.getLogger("apostrophe.pinned_catalog")


def _zone_of(state: State, business_id: int) -> ZoneInfo | None:
    """The business's committed zone, or `None` when it has none or it cannot be loaded.
    Only a failure of the read itself is logged, with the one fixed line."""
    try:
        name = cast(BusinessZone, state.business_zones).zone_of(business_id)
        return None if name is None else load_zone(name)
    except Exception as exc:
        logger.warning("pinned catalog sync failed: %s", type(exc).__name__)
        return None


def run_upkeep_safely(state: State, business_id: int, instant: datetime) -> None:
    zone = _zone_of(state, business_id)
    if zone is None:
        return
    today = business_day(instant, zone)
    engine = cast(Engine, state.engine)
    cipher = cast(TokenCipher, state.pinned_catalog_cipher)
    telegram = cast(PinnedCatalogTelegram, state.pinned_catalog_telegram).channel
    locks = cast(BusinessLocks, state.pinned_catalog_locks)
    clock = cast(Clock, state.clock)
    pricing_settings = cast(
        Callable[[Session, int], CatalogPricingSettings], state.catalog_pricing_settings
    )
    words = cast(CatalogWordsSource, state.catalog_words)
    language = cast(Callable[[Session], CatalogLanguage], state.catalog_language)
    snapshots = SqlPinSnapshots(engine, cipher, pricing_settings, words, language)
    recorder = SqlPinRecorder(engine)
    try:
        push(telegram, snapshots, recorder, locks, business_id, "upkeep", today, clock(), zone)
    except Exception as exc:
        logger.warning("pinned catalog sync failed: %s", type(exc).__name__)
        try:
            record_unreachable(snapshots, recorder, locks, business_id, today)
        except Exception:
            pass  # the bookkeeping attempt itself failed; the WARNING above still fired
