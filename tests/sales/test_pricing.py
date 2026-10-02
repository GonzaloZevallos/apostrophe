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

LIST_ONLY = PriceQuote(list_price=1_000)
WITH_BULK = PriceQuote(list_price=1_000, bulk=BulkQuote(price=700, minimum=Grams.of(10)))
ONE_GRAM = Grams.of(1)


def _price(
    *,
    gift: bool = False,
    special_price: int | None = None,
    vip: bool = False,
    quote: PriceQuote | None = WITH_BULK,
    grams: Grams = ONE_GRAM,
) -> LinePricing:
    return price_line(gift=gift, special_price=special_price, vip=vip, quote=quote, grams=grams)


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


def test_vip_takes_the_bulk_price_even_below_the_minimum() -> None:
    priced = _price(vip=True, quote=WITH_BULK, grams=Grams.of(1))

    assert priced.rule == PricingRule.VIP
    assert priced.price_per_gram == 700


def test_vip_without_a_bulk_price_pays_list() -> None:
    priced = _price(vip=True, quote=LIST_ONLY, grams=Grams.of(1))

    assert priced.rule == PricingRule.LIST
    assert priced.price_per_gram == 1_000


def test_gift_is_zero_and_wins_over_vip() -> None:
    priced = _price(gift=True, vip=True, quote=WITH_BULK, grams=Grams.of(5))

    assert priced.rule == PricingRule.GIFT
    assert priced.price_per_gram == 0
    assert priced.line_total == 0


def test_special_wins_over_vip() -> None:
    priced = _price(special_price=50, vip=True, quote=WITH_BULK, grams=Grams.of(2))

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
