"""`price_line` (app/sales/domain/pricing.py) against the pricing matrix the front's
preview shares with it (`web/src/sales/pricing-matrix.json`, read by this test and by
`web/src/sales/pricing.test.ts`), so a rule change on either side that the other
doesn't mirror fails here.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from app.sales.domain.pricing import (
    BulkQuote,
    GiftWithSpecialPrice,
    InvalidSpecialPrice,
    LinePricing,
    NonPositiveQuantity,
    NoPriceThatDay,
    PriceQuote,
    SaleRuleBroken,
    price_line,
)
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity

MATRIX_PATH = (
    Path(__file__).resolve().parent.parent.parent / "web" / "src" / "sales" / "pricing-matrix.json"
)

ERRORS: dict[str, type[SaleRuleBroken]] = {
    "NonPositiveGrams": NonPositiveQuantity,
    "GiftWithSpecialPrice": GiftWithSpecialPrice,
    "InvalidSpecialPrice": InvalidSpecialPrice,
    "NoPriceThatDay": NoPriceThatDay,
}


def _load_matrix() -> dict[str, Any]:
    with MATRIX_PATH.open() as f:
        return cast(dict[str, Any], json.load(f))


def _quote(raw: dict[str, Any] | None) -> PriceQuote | None:
    if raw is None:
        return None
    bulk_raw = raw["bulk"]
    bulk = (
        None
        if bulk_raw is None
        else BulkQuote(price=bulk_raw["price"], minimum=Quantity(bulk_raw["minimumHundredths"]))
    )
    return PriceQuote(list_price=raw["listPrice"], bulk=bulk, vip_price=raw["vipPrice"])


def _price(raw: dict[str, Any]) -> LinePricing:
    return price_line(
        gift=raw["gift"],
        special_price=raw["specialPrice"],
        customer_is_vip=raw["customerIsVip"],
        settings=PricingSettings(
            is_bulk_pricing=raw["settings"]["bulk"], is_vip_customers=raw["settings"]["vip"]
        ),
        quote=_quote(raw["quote"]),
        quantity=Quantity(raw["gramsHundredths"]),
    )


MATRIX = _load_matrix()


@pytest.mark.parametrize("case", MATRIX["lines"], ids=lambda c: c["name"])
def test_price_line_matches_the_shared_matrix(case: dict[str, Any]) -> None:
    expect = case["expect"]
    if "error" in expect:
        with pytest.raises(ERRORS[expect["error"]]):
            _price(case["input"])
        return
    priced = _price(case["input"])
    assert priced.rule.value == expect["rule"]
    assert priced.price_per_gram == expect["pricePerGram"]
    assert priced.line_total == expect["lineTotal"]


@pytest.mark.parametrize("case", MATRIX["totals"], ids=lambda c: c["name"])
def test_totals_match_the_shared_matrix(case: dict[str, Any]) -> None:
    priced = [_price(line) for line in case["lines"]]
    if "expectRules" in case:
        assert [p.rule.value for p in priced] == case["expectRules"]
    total = sum((p.line_total for p in priced), 0) + case["shippingCharged"]
    assert total == case["expectTotal"]


def test_a_wrong_expectation_in_the_matrix_would_fail_this_suite() -> None:
    """Proves the comparison itself is load-bearing, not only the matrix's own
    cases: the domain's real answer for a real matrix case, checked against a
    deliberately wrong expectation, must fail — because it is `_price`'s genuine
    output being compared, not two hard-coded literals."""
    case = next(
        c for c in MATRIX["lines"] if c["name"] == "list price applies when nothing else does"
    )
    priced = _price(case["input"])
    assert priced.rule.value == case["expect"]["rule"]  # sanity: the real case passes

    wrong_rule = "vip"
    assert wrong_rule != case["expect"]["rule"]
    with pytest.raises(AssertionError):
        assert priced.rule.value == wrong_rule
