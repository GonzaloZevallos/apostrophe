"""Implements the import's `OnboardingEnding` port
(`app/spreadsheet_import/application/ports.py`) for one business (docs/adr/0036): a
successful import ends the Onboarding, through the domain's own `Onboarding.end`.

Only the `onboarding` table, through this hexagon's own `SqlOnboardings`. It flushes and
never commits: the import's `NoCommit` is the transaction it is called with, and
`cli.run` commits once at the end. A business with no row was never offered the
Onboarding, so there is nothing to end.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.shared.transaction import Transaction


class OnboardingEnding:
    def __init__(self, session: Session, business_id: int) -> None:
        self._onboardings = SqlOnboardings(session, business_id)

    def imported(self, at: datetime, transaction: Transaction) -> None:
        onboarding = self._onboardings.get()
        if onboarding is None or onboarding.ended_at is not None:
            return
        onboarding.end(at)
        self._onboardings.save(onboarding)
