"""Settling the first-run stamps that a read found due (docs/adr/0046). `first_run_element`
says which are due; this writes them, once and in one commit. It has no error handling
of its own: the router that calls it decides what a failed write means for the answer."""

from __future__ import annotations

from datetime import datetime

from app.onboarding.application.ports import FirstRuns
from app.onboarding.domain.first_run import Stamp
from app.shared.transaction import Transaction


def settle_first_run(
    due: frozenset[Stamp], now: datetime, first_runs: FirstRuns, transaction: Transaction
) -> None:
    """Stamps each due fact at `now`, in a fixed order, and commits once at its end.
    `imported_at` is the import's alone (it comes from the import's own instant), so a
    set that holds it is refused before anything is written."""
    if Stamp.IMPORTED in due:
        raise ValueError("imported_at is written by the import alone")
    for stamp in sorted(due):
        first_runs.stamp(stamp, now)
    transaction.commit()
