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
    NonPositiveGrams,
    NoPriceThatDay,
    PriceQuote,
    SaleRuleBroken,
    price_line,
)
from app.shared.grams import Grams

MATRIX_PATH = (
    Path(__file__).resolve().parent.parent.parent / "web" / "src" / "sales" / "pricing-matrix.json"
)

ERRORS: dict[str, type[SaleRuleBroken]] = {
    "NonPositiveGrams": NonPositiveGrams,
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
        else BulkQuote(price=bulk_raw["price"], minimum=Grams(bulk_raw["minimumHundredths"]))
    )
    return PriceQuote(list_price=raw["listPrice"], bulk=bulk)


def _price(raw: dict[str, Any]) -> LinePricing:
    return price_line(
        gift=raw["gift"],
        special_price=raw["specialPrice"],
        vip=raw["vip"],
        quote=_quote(raw["quote"]),
        grams=Grams(raw["gramsHundredths"]),
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
    total = sum((_price(line).line_total for line in case["lines"]), 0) + case["shippingCharged"]
    assert total == case["expectTotal"]


def test_the_matrix_rejects_a_case_a_rule_change_would_break() -> None:
    """The matrix itself only proves something once it can fail: a line whose rule
    doesn't match the domain's answer must raise, not pass silently."""
    broken_case = {
        "gift": False,
        "specialPrice": None,
        "vip": False,
        "quote": {"listPrice": 1000, "bulk": None},
        "gramsHundredths": 100,
    }
    priced = _price(broken_case)
    assert priced.rule.value == "list"
    with pytest.raises(AssertionError):
        assert priced.rule.value == "vip"
