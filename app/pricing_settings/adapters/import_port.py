"""`PricingSettingsImport` (`app/spreadsheet_import/application/ports.py`) over the
`pricing_settings` row. The one writer outside this hexagon's PUT use case, and it can
only turn a switch on (docs/adr/0031)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.pricing_settings.adapters.sql_pricing_settings import SqlPricingSettings
from app.shared.pricing_settings import PricingSettings


class PricingSettingsImport:
    """`PricingSettingsImport` for one business."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._settings = SqlPricingSettings(session, business_id)

    def current(self) -> PricingSettings:
        return self._settings.current()

    def switch_on(self, bulk: bool, vip: bool) -> None:
        stored = self._settings.current()
        self._settings.replace(
            PricingSettings(
                is_bulk_pricing=stored.is_bulk_pricing or bulk,
                is_vip_customers=stored.is_vip_customers or vip,
            )
        )
