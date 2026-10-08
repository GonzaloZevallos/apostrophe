"""Test helper: set a business's pricing switches directly, for tests of capabilities that
only read them. The route that writes them belongs to `app/pricing_settings/`."""

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pricing_settings.adapters.tables import PricingSettingsRow


def set_switches(
    engine: Engine, *, bulk: bool, vip: bool, business_name: str = "Primer Negocio"
) -> None:
    with Session(engine) as session:
        business_id = session.scalars(
            select(BusinessRow.id).where(BusinessRow.name == business_name)
        ).one()
        row = session.scalars(
            select(PricingSettingsRow).where(PricingSettingsRow.business_id == business_id)
        ).one()
        row.is_bulk_pricing = bulk
        row.is_vip_customers = vip
        session.commit()
