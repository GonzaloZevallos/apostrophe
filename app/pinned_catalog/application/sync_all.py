"""The day-change sync (plan, "Day change" / ADR-0014): every business with a pin
published and not yet checked on its own today gets upkeep's own attempt — the one trigger
nobody saves, a price entry whose effective date arrives at midnight. Pure application
code: `run` is `safe_upkeep`'s `run_upkeep_safely`, bound to the instant and the app's
state by its one caller, the ticker (`upkeep` subtask); this module never imports it.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from app.pinned_catalog.application.ports import DueBusinesses


def sync_all_published(instant: datetime, due: DueBusinesses, run: Callable[[int], None]) -> None:
    for business_id in due.due(instant):
        run(business_id)
