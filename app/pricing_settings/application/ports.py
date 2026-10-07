"""The pricing-settings hexagon's own port (docs/adr/0006): what `save_pricing_settings`
needs from storage. Declared here; `SqlPricingSettings` implements it."""

from __future__ import annotations

from typing import Protocol

from app.shared.pricing_settings import PricingSettings


class PricingSettingsStore(Protocol):
    def current(self) -> PricingSettings: ...

    def replace(self, settings: PricingSettings) -> None: ...
