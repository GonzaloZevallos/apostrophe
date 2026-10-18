"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business is
offered the Onboarding by inserting its row, inside the same transaction that opens it
(docs/adr/0036). Accounts never imports this module; `app/main.py` is the composition
root that wires it in, through `CompositeOpening`. A joined business gets no row."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.clock import Clock
from app.onboarding.adapters.tables import OnboardingRow


class OnboardingOpening:
    """`created_at` is this opening's own read of the injected clock; it is not asserted
    equal to the acceptance instant, which the accept use case reads on its own."""

    def __init__(self, session: Session, *, clock: Clock) -> None:
        self._session = session
        self._clock = clock

    def opened(self, business_id: int) -> None:
        self._session.add(OnboardingRow(business_id=business_id, created_at=self._clock()))
