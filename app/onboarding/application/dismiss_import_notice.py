"""Ending the after-import notice by hand (docs/adr/0046). Any signed-in user of the
business may, and it is for the whole business. It stamps `import_notice_over_at` only
while the business was imported and the stamp is still null: otherwise it writes
nothing, so asking twice, or for a business that was never imported, is harmless."""

from __future__ import annotations

from datetime import datetime

from app.onboarding.application.ports import FirstRuns
from app.onboarding.domain.first_run import Stamp
from app.shared.transaction import Transaction


def dismiss_import_notice(first_runs: FirstRuns, now: datetime, transaction: Transaction) -> None:
    stored = first_runs.get()
    if stored is None or stored.imported_at is None or stored.import_notice_over_at is not None:
        return
    first_runs.stamp(Stamp.IMPORT_NOTICE_OVER, now)
    transaction.commit()
