"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business is
offered the Onboarding by inserting its row, inside the same transaction that opens it
(docs/adr/0035). Accounts never imports this module; `app/main.py` is the composition
root that wires it in, through `CompositeOpening`. A joined business gets no row."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.onboarding.adapters.tables import OnboardingRow


class OnboardingOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int) -> None:
        self._session.add(OnboardingRow(business_id=business_id))
