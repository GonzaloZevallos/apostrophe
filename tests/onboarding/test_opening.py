"""Who gets the Onboarding (docs/adr/0032), through `POST /invitations/{token}/accept`:
accepting a new-business invitation leaves exactly one row for the new business, and
accepting a join invitation adds none."""

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.adapters.tables import OnboardingRow
from app.onboarding.domain.onboarding import Onboarding
from tests.conftest import PASSWORD, MovableClock, invite

NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def _rows(engine: Engine) -> list[int]:
    with Session(engine) as session:
        return sorted(session.scalars(select(OnboardingRow.business_id)).all())


def test_accepting_a_new_business_invitation_leaves_exactly_one_unfinished_row(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    accepted = anonymous_client.post(
        f"/invitations/{invite(engine, clock())}/accept", json=NEW_USER
    )

    assert accepted.status_code == 201
    with Session(engine) as session:
        opened = session.scalars(select(BusinessRow.id).where(BusinessRow.name == "La Huerta"))
        business_id = opened.one()
        assert session.scalar(select(func.count()).select_from(OnboardingRow)) == 1
        assert SqlOnboardings(session, business_id).get() == Onboarding.opened()
        # Another business's row is, from here, a row that does not exist.
        assert SqlOnboardings(session, business_id + 1).get() is None


def test_accepting_a_join_invitation_adds_no_row(
    client: TestClient, anonymous_client: TestClient, engine: Engine
) -> None:
    before = _rows(engine)
    issued = client.post("/invitations")
    token = issued.json()["url"].rsplit("/", 1)[-1]
    partner = {**NEW_USER, "email": "socio@example.com", "business_name": "Ignored"}

    accepted = anonymous_client.post(f"/invitations/{token}/accept", json=partner)

    assert accepted.status_code == 201
    assert _rows(engine) == before
