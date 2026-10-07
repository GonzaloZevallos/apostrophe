"""Implements the Onboarding's `VarietyFacts` port (docs/adr/0032) for one business:
read-only, each variety's id and name and whether it has a price in force today.
Varieties never imports the Onboarding; `app/main.py` wires this in."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.onboarding.domain.progress import VarietyFact
from app.varieties.adapters.sql_varieties import SqlVarieties


class SqlVarietyFacts:
    def __init__(self, session: Session, business_id: int, today: date) -> None:
        self._varieties = SqlVarieties(session, business_id)
        self._today = today

    def varieties(self) -> list[VarietyFact]:
        return [
            VarietyFact(
                id=variety.id,
                name=variety.name.value,
                is_priced_today=variety.current_price(self._today) is not None,
            )
            for variety in self._varieties.all()
            if variety.id is not None
        ]
