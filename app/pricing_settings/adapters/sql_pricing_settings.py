"""The business's pricing switches over `pricing_settings`. Built for one business; a
business with no row is `PricingSettingsMissing`, never a default (docs/adr/0031)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pricing_settings.adapters.tables import PricingSettingsRow
from app.pricing_settings.domain.errors import PricingSettingsMissing
from app.shared.pricing_settings import PricingSettings


class SqlPricingSettings:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def current(self) -> PricingSettings:
        row = self._session.scalar(
            select(PricingSettingsRow).where(PricingSettingsRow.business_id == self._business_id)
        )
        if row is None:
            raise PricingSettingsMissing()
        return PricingSettings(
            is_bulk_pricing=row.is_bulk_pricing, is_vip_customers=row.is_vip_customers
        )
