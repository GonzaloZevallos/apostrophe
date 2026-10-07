"""A business's pricing switches (CONTEXT.md: Pricing settings, docs/adr/0031).

The value every reader speaks: sales, varieties, customers, the catalog and the import
each declare their own `current() -> PricingSettings` port, and none imports the
hexagon that stores it.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PricingSettings:
    """Which of the two optional pricing rules a business uses: Precio por cantidad
    (the bulk price) and Clientes VIP (the VIP price)."""

    is_bulk_pricing: bool
    is_vip_customers: bool
