"""Implements the import's `OnboardingEnding` port
(`app/spreadsheet_import/application/ports.py`) for one business (docs/adr/0036,
docs/adr/0046): a successful import ends the Onboarding, through the domain's own
`Onboarding.end`, and stamps `first_run.imported_at` with the import's own instant. This
adapter is the only writer of `imported_at`.

Only the `onboarding` and `first_run` tables, through this hexagon's own repositories. It
flushes and never commits and reads no clock: the import's `NoCommit` is the transaction
it is called with, and `cli.run` commits once at the end. A business with no Onboarding
row was never offered one, so there is nothing to end; it is stamped as imported all the
same.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.shared.transaction import Transaction


class OnboardingEnding:
    def __init__(self, session: Session, business_id: int) -> None:
        self._onboardings = SqlOnboardings(session, business_id)
        self._first_runs = SqlFirstRuns(session, business_id)

    def imported(self, at: datetime, transaction: Transaction) -> None:
        onboarding = self._onboardings.get()
        if onboarding is not None and onboarding.ended_at is None:
            onboarding.end(at)
            self._onboardings.save(onboarding)
        self._first_runs.imported(at)
