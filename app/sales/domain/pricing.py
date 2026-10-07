"""How a sale line is priced (CONTEXT.md: Pricing rule, Bulk price, Bulk minimum; ADR-0003).

Gift wins, then special price; otherwise the lowest of the rules that apply: list,
bulk (Precio por cantidad on and the line reaches the bulk minimum, measured per line,
never summed across a sale) and VIP (Clientes VIP on, a VIP customer and a VIP price) —
always from the variety's current price on the sale's date (docs/adr/0034).

`line_total` and `special_rate` are the only two roundings anywhere in sales, both half
up and both integer arithmetic: no `round()`, `float` or `Decimal.quantize` in a sales
money path.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

from app.shared.grams import Grams
from app.shared.pricing_settings import PricingSettings


class SaleRuleBroken(ValueError):
    """A rule of sales was broken; the message says which, never the data."""

    code: ClassVar[str] = "sale.rule_broken"


class InvalidPriceQuote(SaleRuleBroken):
    code: ClassVar[str] = "sale.price_quote_invalid"

    def __init__(self) -> None:
        super().__init__("that is not a valid price quote")


class NonPositiveGrams(SaleRuleBroken):
    # Distinct from the shared `grams.invalid` (not a number, or more than two
    # decimals): this is a sale rule, grams that parsed fine but are not above zero.
    code: ClassVar[str] = "sale.grams_invalid"

    def __init__(self) -> None:
        super().__init__("a line needs grams above zero")


class GiftWithSpecialPrice(SaleRuleBroken):
    code: ClassVar[str] = "sale.gift_with_special_price"

    def __init__(self) -> None:
        super().__init__("a line cannot be both a gift and have a special price")


class InvalidSpecialPrice(SaleRuleBroken):
    code: ClassVar[str] = "sale.special_price_invalid"

    def __init__(self) -> None:
        super().__init__("a special price must be above zero")


class NoPriceThatDay(SaleRuleBroken):
    code: ClassVar[str] = "sale.no_price_that_day"

    def __init__(self) -> None:
        super().__init__("the variety has no price on the sale's date")


class PricingRule(StrEnum):
    LIST = "list"
    BULK = "bulk"
    VIP = "vip"
    GIFT = "gift"
    SPECIAL = "special"


@dataclass(frozen=True)
class BulkQuote:
    """A variety's bulk price and the grams it applies from (CONTEXT.md: Bulk price,
    Bulk minimum)."""

    price: int
    minimum: Grams

    def __post_init__(self) -> None:
        if self.price <= 0:
            raise InvalidPriceQuote()
        if not self.minimum.is_positive:
            raise InvalidPriceQuote()


@dataclass(frozen=True)
class PriceQuote:
    """A variety's current price on some date (CONTEXT.md: Current price): a list
    price, and optionally a bulk price lower than it and a VIP price lower than it. The
    VIP price is never compared with the bulk price; `None` means no VIP price."""

    list_price: int
    bulk: BulkQuote | None = None
    vip_price: int | None = None

    def __post_init__(self) -> None:
        if self.list_price <= 0:
            raise InvalidPriceQuote()
        if self.bulk is not None and self.bulk.price >= self.list_price:
            raise InvalidPriceQuote()
        if self.vip_price is not None and not 0 < self.vip_price < self.list_price:
            raise InvalidPriceQuote()


@dataclass(frozen=True)
class VarietyPricing:
    """What `PriceBook.for_variety` answers for a variety that exists in the business:
    its current price on the asked date, or `None` when it has none that day."""

    variety_id: int
    current: PriceQuote | None


def line_total(price_per_gram: int, grams: Grams) -> int:
    """`price_per_gram x grams`, rounded to the whole peso, half up (PM clarification,
    round 1): `(price*h + 50) // 100`, with `h` the grams in hundredths."""
    return (price_per_gram * grams.hundredths + 50) // 100


def special_rate(total: int, grams: Grams) -> int:
    """The price per gram implied by a special price's whole-peso total, half up. This
    figure is stored for reference only: it never feeds back into a total (ADR-0003)."""
    h = grams.hundredths
    return (200 * total + h) // (2 * h)


@dataclass(frozen=True)
class LinePricing:
    rule: PricingRule
    price_per_gram: int
    line_total: int


def price_line(
    *,
    gift: bool,
    special_price: int | None,
    customer_is_vip: bool,
    settings: PricingSettings,
    quote: PriceQuote | None,
    grams: Grams,
) -> LinePricing:
    """Price one sale line. Refuses grams <= 0, a gift combined with a special price,
    a special price <= 0, and a missing quote with no special price to replace it.

    Otherwise the lowest applicable rule names the line; a VIP price that ties with the
    bulk price is stored as VIP, and any other strictly lowest rule keeps its name."""
    if not grams.is_positive:
        raise NonPositiveGrams()
    if gift and special_price is not None:
        raise GiftWithSpecialPrice()
    if gift:
        return LinePricing(PricingRule.GIFT, 0, 0)
    if special_price is not None:
        if special_price <= 0:
            raise InvalidSpecialPrice()
        return LinePricing(PricingRule.SPECIAL, special_rate(special_price, grams), special_price)
    if quote is None:
        raise NoPriceThatDay()
    # Candidates in the order a tie is settled: VIP, then bulk, then list.
    candidates: list[tuple[PricingRule, int]] = []
    if settings.is_vip_customers and customer_is_vip and quote.vip_price is not None:
        candidates.append((PricingRule.VIP, quote.vip_price))
    if (
        settings.is_bulk_pricing
        and quote.bulk is not None
        and grams.hundredths >= quote.bulk.minimum.hundredths
    ):
        candidates.append((PricingRule.BULK, quote.bulk.price))
    candidates.append((PricingRule.LIST, quote.list_price))
    rule, price = min(candidates, key=lambda candidate: candidate[1])
    return LinePricing(rule, price, line_total(price, grams))
