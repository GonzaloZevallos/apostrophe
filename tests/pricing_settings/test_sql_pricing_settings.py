"""`SqlPricingSettings.current()` and the opening seed, at the declared seams: the
port itself over a real session, and an accepted invitation over HTTP."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pricing_settings.adapters.sql_pricing_settings import SqlPricingSettings
from app.pricing_settings.adapters.tables import PricingSettingsRow
from app.pricing_settings.domain.errors import PricingSettingsMissing
from app.shared.pricing_settings import PricingSettings
from tests.conftest import NOW, PASSWORD, invite


def _business_id(session: Session, name: str) -> int:
    return session.scalars(select(BusinessRow.id).where(BusinessRow.name == name)).one()


def test_a_new_business_opens_with_exactly_one_row_both_switches_off(
    anonymous_client: TestClient, engine: Engine
) -> None:
    accepted = anonymous_client.post(
        f"/invitations/{invite(engine, NOW)}/accept",
        json={"business_name": "La Huerta", "email": "nueva@example.com", "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text

    with Session(engine) as session:
        business_id = _business_id(session, "La Huerta")
        rows = session.scalars(
            select(PricingSettingsRow).where(PricingSettingsRow.business_id == business_id)
        ).all()
        assert len(rows) == 1
        assert (rows[0].is_bulk_pricing, rows[0].is_vip_customers) == (False, False)
        assert SqlPricingSettings(session, business_id).current() == PricingSettings(
            is_bulk_pricing=False, is_vip_customers=False
        )


def test_current_reads_only_its_own_businesss_switches(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        mine = _business_id(session, "Primer Negocio")
        other = _business_id(session, "Otro Negocio")
        row = session.scalars(
            select(PricingSettingsRow).where(PricingSettingsRow.business_id == mine)
        ).one()
        row.is_vip_customers = True
        session.commit()

        assert SqlPricingSettings(session, mine).current() == PricingSettings(False, True)
        assert SqlPricingSettings(session, other).current() == PricingSettings(False, False)


def test_current_raises_when_the_business_has_no_row_and_never_defaults(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        business_id = _business_id(session, "Primer Negocio")
        row = session.scalars(
            select(PricingSettingsRow).where(PricingSettingsRow.business_id == business_id)
        ).one()
        session.delete(row)
        session.commit()

        with pytest.raises(PricingSettingsMissing) as raised:
            SqlPricingSettings(session, business_id).current()

        assert isinstance(raised.value, LookupError)
        assert str(business_id) not in str(raised.value)
