"""The cost-and-margins use case over a fake LatestCostedPurchase port."""

from datetime import UTC, date, datetime

from app.products.application.cost_and_margins import cost_and_margins_of
from app.products.domain.cost_and_margins import (
    CostAndMargins,
    CostedPurchase,
    PriceMargin,
    PriceRule,
)
from app.products.domain.product import BulkTerms, PriceEntry, Product, ProductName
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity

TODAY = date(2026, 5, 10)
BOTH = PricingSettings(is_bulk_pricing=True, is_vip_customers=True)
NEITHER = PricingSettings(is_bulk_pricing=False, is_vip_customers=False)


class FakePurchases:
    def __init__(self, purchase: CostedPurchase | None) -> None:
        self.purchase = purchase
        self.calls: list[tuple[int, date]] = []

    def latest_on(self, product_id: int, day: date) -> CostedPurchase | None:
        self.calls.append((product_id, day))
        return self.purchase


def costed(total_cost: int = 50, units: int = 1) -> CostedPurchase:
    return CostedPurchase(total_cost=total_cost, quantity=Quantity.of(units))


def product(*entries: PriceEntry) -> Product:
    return Product(name=ProductName.of("Gold"), price_entries=entries, id=7)


def full_entry(effective_from: date = date(2026, 1, 1)) -> PriceEntry:
    return PriceEntry(
        effective_from=effective_from,
        list_price=100,
        bulk=BulkTerms(price=80, minimum=Quantity.of(10)),
        vip_price=60,
    )


def test_an_archived_variety_gives_nothing_and_the_port_is_not_called() -> None:
    archived = product(full_entry())
    archived.archive(datetime(2026, 2, 1, tzinfo=UTC))
    purchases = FakePurchases(costed())

    assert cost_and_margins_of(archived, BOTH, purchases, TODAY) is None
    assert purchases.calls == []


def test_a_variety_with_no_costed_purchase_has_no_cost_and_no_margin() -> None:
    purchases = FakePurchases(None)

    result = cost_and_margins_of(product(full_entry()), BOTH, purchases, TODAY)

    assert result == CostAndMargins(None, ())
    assert purchases.calls == [(7, TODAY)]


def test_a_variety_with_no_current_price_has_a_cost_and_no_margin() -> None:
    future = full_entry(effective_from=date(2026, 6, 1))

    assert cost_and_margins_of(product(future), BOTH, FakePurchases(costed()), TODAY) == (
        CostAndMargins(50, ())
    )
    assert cost_and_margins_of(product(), BOTH, FakePurchases(costed()), TODAY) == (
        CostAndMargins(50, ())
    )


def test_the_margins_follow_list_bulk_vip_order() -> None:
    result = cost_and_margins_of(product(full_entry()), BOTH, FakePurchases(costed()), TODAY)

    assert result == CostAndMargins(
        50,
        (
            PriceMargin(PriceRule.LIST, 50),
            PriceMargin(PriceRule.BULK, 38),
            PriceMargin(PriceRule.VIP, 17),
        ),
    )


def test_the_prices_come_from_the_entry_in_force_today() -> None:
    older = full_entry(date(2026, 1, 1))
    newer = PriceEntry(effective_from=date(2026, 5, 1), list_price=200)

    result = cost_and_margins_of(product(older, newer), BOTH, FakePurchases(costed()), TODAY)

    assert result == CostAndMargins(50, (PriceMargin(PriceRule.LIST, 75),))


def test_bulk_needs_the_switch_and_a_bulk_price() -> None:
    switched_off = PricingSettings(is_bulk_pricing=False, is_vip_customers=False)
    no_bulk = PriceEntry(effective_from=date(2026, 1, 1), list_price=100)
    only_bulk = PricingSettings(is_bulk_pricing=True, is_vip_customers=False)

    off = cost_and_margins_of(product(full_entry()), switched_off, FakePurchases(costed()), TODAY)
    missing = cost_and_margins_of(product(no_bulk), only_bulk, FakePurchases(costed()), TODAY)
    on = cost_and_margins_of(product(full_entry()), only_bulk, FakePurchases(costed()), TODAY)

    assert off is not None and [m.rule for m in off.margins] == [PriceRule.LIST]
    assert missing is not None and [m.rule for m in missing.margins] == [PriceRule.LIST]
    assert on is not None and [m.rule for m in on.margins] == [PriceRule.LIST, PriceRule.BULK]


def test_vip_needs_the_switch_and_a_vip_price() -> None:
    only_vip = PricingSettings(is_bulk_pricing=False, is_vip_customers=True)
    no_vip = PriceEntry(effective_from=date(2026, 1, 1), list_price=100)

    off = cost_and_margins_of(product(full_entry()), NEITHER, FakePurchases(costed()), TODAY)
    missing = cost_and_margins_of(product(no_vip), only_vip, FakePurchases(costed()), TODAY)
    on = cost_and_margins_of(product(full_entry()), only_vip, FakePurchases(costed()), TODAY)

    assert off is not None and [m.rule for m in off.margins] == [PriceRule.LIST]
    assert missing is not None and [m.rule for m in missing.margins] == [PriceRule.LIST]
    assert on is not None and [m.rule for m in on.margins] == [PriceRule.LIST, PriceRule.VIP]


def test_a_free_purchase_is_a_margin_of_one_hundred_on_every_price() -> None:
    result = cost_and_margins_of(product(full_entry()), BOTH, FakePurchases(costed(0)), TODAY)

    assert result == CostAndMargins(
        0,
        (
            PriceMargin(PriceRule.LIST, 100),
            PriceMargin(PriceRule.BULK, 100),
            PriceMargin(PriceRule.VIP, 100),
        ),
    )
