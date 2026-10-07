"""`PUT /pricing-settings`'s use case (CONTEXT.md: Pricing settings): stores both
switches and commits once. It answers whether either one differs from what was stored,
so the caller knows whether the pinned catalog's text may have changed (docs/adr/0014).
"""

from __future__ import annotations

from app.pricing_settings.application.ports import PricingSettingsStore
from app.shared.pricing_settings import PricingSettings
from app.shared.transaction import Transaction


def save_pricing_settings(
    store: PricingSettingsStore, transaction: Transaction, settings: PricingSettings
) -> bool:
    changed = store.current() != settings
    store.replace(settings)
    transaction.commit()
    return changed
