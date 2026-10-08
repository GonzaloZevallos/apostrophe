"""The `Onboardings` port over the `onboarding` table. Built for one business: every
statement filters on it, so another business's row is a row that does not exist. It
flushes and never commits."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.onboarding.adapters.tables import OnboardingRow
from app.onboarding.domain.onboarding import Onboarding, Pass


def _pass(value: str | None) -> Pass | None:
    return None if value is None else Pass(value)


class SqlOnboardings:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self) -> Onboarding | None:
        row = self._row()
        if row is None:
            return None
        return Onboarding(
            header_footer=_pass(row.header_footer_pass),
            bot=_pass(row.bot_pass),
            partner=_pass(row.partner_pass),
            categories=_pass(row.categories_pass),
            ended_at=row.ended_at,
        )

    def save(self, onboarding: Onboarding) -> None:
        row = self._row()
        assert row is not None, "save is only for an Onboarding that exists"
        row.header_footer_pass = _value(onboarding.header_footer)
        row.bot_pass = _value(onboarding.bot)
        row.partner_pass = _value(onboarding.partner)
        row.categories_pass = _value(onboarding.categories)
        row.ended_at = onboarding.ended_at
        self._session.flush()

    def _row(self) -> OnboardingRow | None:
        statement = select(OnboardingRow).where(OnboardingRow.business_id == self._business_id)
        return self._session.scalar(statement)


def _value(value: Pass | None) -> str | None:
    return None if value is None else value.value
