from __future__ import annotations

from pydantic import BaseModel

from app.shared.pricing_settings import PricingSettings


class PricingSettingsBody(BaseModel):
    """The request and the answer of `/pricing-settings`: the same two switches."""

    is_bulk_pricing: bool
    is_vip_customers: bool

    @classmethod
    def of(cls, settings: PricingSettings) -> PricingSettingsBody:
        return cls(
            is_bulk_pricing=settings.is_bulk_pricing, is_vip_customers=settings.is_vip_customers
        )

    def to_settings(self) -> PricingSettings:
        return PricingSettings(
            is_bulk_pricing=self.is_bulk_pricing, is_vip_customers=self.is_vip_customers
        )
