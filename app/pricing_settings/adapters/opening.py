"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets its
`pricing_settings` row, both switches off, inside the same transaction that opens it.
Accounts never imports this module; `app/main.py` wires it into `CompositeOpening`.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.pricing_settings.adapters.tables import PricingSettingsRow
from app.shared.language import BusinessLanguage


class PricingSettingsOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        self._session.add(
            PricingSettingsRow(
                business_id=business_id, is_bulk_pricing=False, is_vip_customers=False
            )
        )
