"""The cost and margins of a variety today (GH-522): its latest costed Purchase against
each price the business uses."""

from __future__ import annotations

from datetime import date

from app.products.application.ports import LatestCostedPurchase
from app.products.domain.cost_and_margins import CostAndMargins, PriceRule, cost_and_margins
from app.products.domain.product import Product
from app.shared.pricing_settings import PricingSettings


def cost_and_margins_of(
    product: Product,
    settings: PricingSettings,
    purchases: LatestCostedPurchase,
    today: date,
) -> CostAndMargins | None:
    """`None` for an archived variety, whose port is never called. Otherwise the prices are
    the ones of `product.current_price(today)`: list always, bulk when the business uses
    it and the entry has one, VIP when the business uses it and the entry has one. With
    no current price there is no margin; with no costed Purchase, no cost."""
    if product.is_archived:
        return None
    assert product.id is not None
    prices: list[tuple[PriceRule, int]] = []
    entry = product.current_price(today)
    if entry is not None:
        prices.append((PriceRule.LIST, entry.list_price))
        if settings.is_bulk_pricing and entry.bulk is not None:
            prices.append((PriceRule.BULK, entry.bulk.price))
        if settings.is_vip_customers and entry.vip_price is not None:
            prices.append((PriceRule.VIP, entry.vip_price))
    return cost_and_margins(purchases.latest_on(product.id, today), prices)
