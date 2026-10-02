"""How a sale line is priced (CONTEXT.md: Pricing rule, Bulk price, Bulk minimum; ADR-0003).

The first rule that applies wins: gift, then special price, then VIP, then bulk
(measured per line, never summed across a sale), then list — always from the variety's
current price on the sale's date.

`line_total` and `special_rate` are the only two roundings anywhere in sales, both half
up and both integer arithmetic: no `round()`, `float` or `Decimal.quantize` in a sales
money path.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.shared.grams import Grams


class SaleRuleBroken(ValueError):
    """A rule of sales was broken; the message says which, never the data."""


class InvalidPriceQuote(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("that is not a valid price quote")


class NonPositiveGrams(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a line needs grams above zero")


class GiftWithSpecialPrice(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a line cannot be both a gift and have a special price")


class InvalidSpecialPrice(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a special price must be above zero")


class NoPriceThatDay(SaleRuleBroken):
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
    price, and optionally a bulk price lower than it."""

    list_price: int
    bulk: BulkQuote | None = None

    def __post_init__(self) -> None:
        if self.list_price <= 0:
            raise InvalidPriceQuote()
        if self.bulk is not None and self.bulk.price >= self.list_price:
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
    vip: bool,
    quote: PriceQuote | None,
    grams: Grams,
) -> LinePricing:
    """Price one sale line. Refuses grams <= 0, a gift combined with a special price,
    a special price <= 0, and a missing quote with no special price to replace it."""
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
    if vip and quote.bulk is not None:
        price = quote.bulk.price
        return LinePricing(PricingRule.VIP, price, line_total(price, grams))
    if quote.bulk is not None and grams.hundredths >= quote.bulk.minimum.hundredths:
        price = quote.bulk.price
        return LinePricing(PricingRule.BULK, price, line_total(price, grams))
    return LinePricing(PricingRule.LIST, quote.list_price, line_total(quote.list_price, grams))
