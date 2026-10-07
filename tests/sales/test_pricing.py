"""The pricing matrix of a sale line (CONTEXT.md: Pricing rule; docs/adr/0003), with no
infrastructure. The first rule that applies wins: gift, special, VIP, bulk (per line),
list. `line_total` and `special_rate` are the only roundings in sales, half up, in
integer arithmetic.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest

from app.sales.domain.pricing import (
    BulkQuote,
    GiftWithSpecialPrice,
    InvalidPriceQuote,
    InvalidSpecialPrice,
    LinePricing,
    NonPositiveGrams,
    NoPriceThatDay,
    PriceQuote,
    PricingRule,
    SaleRuleBroken,
    line_total,
    price_line,
    special_rate,
)
from app.shared.grams import Grams
from app.shared.pricing_settings import PricingSettings

LIST_ONLY = PriceQuote(list_price=1_000)
WITH_BULK = PriceQuote(list_price=1_000, bulk=BulkQuote(price=700, minimum=Grams.of(10)))
WITH_VIP = PriceQuote(
    list_price=1_000, bulk=BulkQuote(price=700, minimum=Grams.of(10)), vip_price=600
)
ONE_GRAM = Grams.of(1)
BOTH_ON = PricingSettings(is_bulk_pricing=True, is_vip_customers=True)
BOTH_OFF = PricingSettings(is_bulk_pricing=False, is_vip_customers=False)


def _price(
    *,
    gift: bool = False,
    special_price: int | None = None,
    vip: bool = False,
    settings: PricingSettings = BOTH_ON,
    quote: PriceQuote | None = WITH_BULK,
    grams: Grams = ONE_GRAM,
) -> LinePricing:
    return price_line(
        gift=gift,
        special_price=special_price,
        customer_is_vip=vip,
        settings=settings,
        quote=quote,
        grams=grams,
    )


# -- PriceQuote / BulkQuote: validated in __post_init__ --------------------------------


def test_a_price_quote_needs_a_positive_list_price() -> None:
    with pytest.raises(InvalidPriceQuote):
        PriceQuote(list_price=0)


def test_a_bulk_quote_needs_a_positive_price() -> None:
    with pytest.raises(InvalidPriceQuote):
        BulkQuote(price=0, minimum=Grams.of(10))


def test_a_bulk_quote_needs_a_positive_minimum() -> None:
    with pytest.raises(InvalidPriceQuote):
        BulkQuote(price=700, minimum=Grams.of(0))


def test_a_bulk_price_must_be_lower_than_the_list_price() -> None:
    with pytest.raises(InvalidPriceQuote):
        PriceQuote(list_price=1_000, bulk=BulkQuote(price=1_000, minimum=Grams.of(10)))


@pytest.mark.parametrize("vip_price", [1_000, 1_001, 0, -5])
def test_a_vip_price_must_be_above_zero_and_below_the_list_price(vip_price: int) -> None:
    with pytest.raises(InvalidPriceQuote):
        PriceQuote(list_price=1_000, vip_price=vip_price)


def test_a_vip_price_is_never_compared_with_the_bulk_price() -> None:
    above_bulk = PriceQuote(
        list_price=1_000, bulk=BulkQuote(price=700, minimum=Grams.of(10)), vip_price=800
    )

    assert above_bulk.vip_price == 800


def test_every_price_quote_refusal_message_carries_no_input_value() -> None:
    cases: list[Callable[[], object]] = [
        lambda: PriceQuote(list_price=1_000, vip_price=1_000),
        lambda: PriceQuote(list_price=1_000, vip_price=0),
        lambda: PriceQuote(list_price=0),
        lambda: BulkQuote(price=0, minimum=Grams.of(10)),
        lambda: BulkQuote(price=700, minimum=Grams.of(0)),
        lambda: PriceQuote(list_price=1_000, bulk=BulkQuote(price=1_000, minimum=Grams.of(10))),
    ]
    for build in cases:
        with pytest.raises(InvalidPriceQuote) as excinfo:
            build()
        assert not any(c.isdigit() for c in str(excinfo.value))


# -- line_total -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("price_per_gram", "grams", "expected"),
    [
        (10_001, "1.55", 15_502),
        (3_001, "2.50", 7_503),
        (1, "0.49", 0),  # a fractional .49 rounds down
    ],
)
def test_line_total_rounds_half_up_to_the_peso(
    price_per_gram: int, grams: str, expected: int
) -> None:
    assert line_total(price_per_gram, Grams.of(grams)) == expected


# -- special_rate -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("total", "grams", "expected"),
    [
        (5, "2.00", 3),
        (10_000, "3.00", 3_333),
        (1, "0.03", 33),
        (7, "2.00", 4),
        (3, "2.00", 2),
    ],
)
def test_special_rate_rounds_half_up(total: int, grams: str, expected: int) -> None:
    assert special_rate(total, Grams.of(grams)) == expected


# -- price_line: each rule, in the order it wins ---------------------------------------


def test_list_price_applies_when_nothing_else_does() -> None:
    priced = _price(quote=LIST_ONLY, grams=Grams.of(1))

    assert priced.rule == PricingRule.LIST
    assert priced.price_per_gram == 1_000


def test_bulk_price_applies_at_the_minimum_grams_measured_per_line() -> None:
    priced = _price(quote=WITH_BULK, grams=Grams.of(10))

    assert priced.rule == PricingRule.BULK
    assert priced.price_per_gram == 700


def test_below_the_minimum_stays_list() -> None:
    priced = _price(quote=WITH_BULK, grams=Grams.of("9.99"))

    assert priced.rule == PricingRule.LIST


def test_vip_takes_its_own_price_below_the_minimum() -> None:
    priced = _price(vip=True, quote=WITH_VIP, grams=Grams.of(1))

    assert priced.rule == PricingRule.VIP
    assert priced.price_per_gram == 600


def test_vip_without_a_vip_price_pays_like_anyone_else() -> None:
    below = _price(vip=True, quote=WITH_BULK, grams=Grams.of(1))
    at_minimum = _price(vip=True, quote=WITH_BULK, grams=Grams.of(10))

    assert (below.rule, below.price_per_gram) == (PricingRule.LIST, 1_000)
    assert (at_minimum.rule, at_minimum.price_per_gram) == (PricingRule.BULK, 700)


def test_vip_with_the_switch_off_pays_like_anyone_else() -> None:
    settings = PricingSettings(is_bulk_pricing=True, is_vip_customers=False)

    priced = _price(vip=True, settings=settings, quote=WITH_VIP, grams=Grams.of(1))

    assert priced.rule == PricingRule.LIST


def test_bulk_with_the_switch_off_is_not_applied_at_the_minimum() -> None:
    priced = _price(settings=BOTH_OFF, quote=WITH_VIP, grams=Grams.of(10))

    assert priced.rule == PricingRule.LIST


def test_a_vip_tie_with_bulk_is_stored_as_vip() -> None:
    quote = PriceQuote(
        list_price=1_000, bulk=BulkQuote(price=700, minimum=Grams.of(10)), vip_price=700
    )

    assert _price(vip=True, quote=quote, grams=Grams.of(10)).rule == PricingRule.VIP


def test_a_vip_price_above_bulk_at_the_minimum_is_stored_as_bulk() -> None:
    quote = PriceQuote(
        list_price=1_000, bulk=BulkQuote(price=700, minimum=Grams.of(10)), vip_price=800
    )

    priced = _price(vip=True, quote=quote, grams=Grams.of(10))

    assert (priced.rule, priced.price_per_gram) == (PricingRule.BULK, 700)


def test_gift_is_zero_and_wins_over_vip() -> None:
    priced = _price(gift=True, vip=True, quote=WITH_VIP, grams=Grams.of(5))

    assert priced.rule == PricingRule.GIFT
    assert priced.price_per_gram == 0
    assert priced.line_total == 0


def test_special_wins_over_vip() -> None:
    priced = _price(special_price=50, vip=True, quote=WITH_VIP, grams=Grams.of(2))

    assert priced.rule == PricingRule.SPECIAL
    assert priced.line_total == 50


def test_special_line_total_is_the_typed_total_regardless_of_the_rate() -> None:
    priced = _price(special_price=7, grams=Grams.of(2))

    assert priced.line_total == 7
    assert priced.price_per_gram == special_rate(7, Grams.of(2))


def test_no_price_that_day_without_a_special_price_is_refused() -> None:
    with pytest.raises(NoPriceThatDay):
        _price(quote=None)


def test_no_price_that_day_with_a_special_price_still_prices() -> None:
    priced = _price(quote=None, special_price=12, grams=Grams.of(3))

    assert priced.rule == PricingRule.SPECIAL
    assert priced.line_total == 12


def test_gift_with_special_price_is_refused() -> None:
    with pytest.raises(GiftWithSpecialPrice):
        _price(gift=True, special_price=12)


@pytest.mark.parametrize("special_price", [0, -5])
def test_a_special_price_must_be_above_zero(special_price: int) -> None:
    with pytest.raises(InvalidSpecialPrice):
        _price(special_price=special_price)


@pytest.mark.parametrize("grams", ["0", "-1"])
def test_grams_must_be_positive(grams: str) -> None:
    with pytest.raises(NonPositiveGrams):
        _price(grams=Grams.of(grams))


def test_every_pricing_refusal_message_carries_no_input_value() -> None:
    cases: list[tuple[type[SaleRuleBroken], Callable[[], LinePricing]]] = [
        (GiftWithSpecialPrice, lambda: _price(gift=True, special_price=12)),
        (InvalidSpecialPrice, lambda: _price(special_price=0)),
        (NoPriceThatDay, lambda: _price(quote=None)),
        (NonPositiveGrams, lambda: _price(grams=Grams.of("0"))),
    ]
    for exc_type, action in cases:
        with pytest.raises(exc_type) as excinfo:
            action()
        assert not any(c.isdigit() for c in str(excinfo.value))
