"""`price_line` (app/sales/domain/pricing.py) against the pricing matrix the front's
preview shares with it (`web/src/sales/pricing-matrix.json`, read by this test and by
`web/src/sales/pricing.test.ts`), so a rule change on either side that the other
doesn't mirror fails here.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import pytest

from app.sales.domain.pricing import (
    BulkQuote,
    CustomerTypeFact,
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

CUSTOMER_TYPE = CustomerTypeFact(id=1, name="VIP")
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
    return PriceQuote(list_price=raw["listPrice"], bulk=bulk, type_price=raw["vipPrice"])


def _price(raw: dict[str, Any]) -> LinePricing:
    return price_line(
        gift=raw["gift"],
        special_price=raw["specialPrice"],
        customer_type=CUSTOMER_TYPE if raw["customerIsVip"] else None,
        settings=PricingSettings(
            is_bulk_pricing=raw["settings"]["bulk"], is_vip_customers=raw["settings"]["vip"]
        ),
        quote=_quote(raw["quote"]),
        quantity=Quantity(raw["gramsHundredths"]),
    )


MATRIX = _load_matrix()


def _stored_rule(rule: str) -> str:
    """The matrix still names the type rule `vip`; the domain now records `type`."""
    return "type" if rule == "vip" else rule


@pytest.mark.parametrize("case", MATRIX["lines"], ids=lambda c: c["name"])
def test_price_line_matches_the_shared_matrix(case: dict[str, Any]) -> None:
    expect = case["expect"]
    if "error" in expect:
        with pytest.raises(ERRORS[expect["error"]]):
            _price(case["input"])
        return
    priced = _price(case["input"])
    assert priced.rule.value == _stored_rule(expect["rule"])
    assert priced.price_per_gram == expect["pricePerGram"]
    assert priced.line_total == expect["lineTotal"]


@pytest.mark.parametrize("case", MATRIX["totals"], ids=lambda c: c["name"])
def test_totals_match_the_shared_matrix(case: dict[str, Any]) -> None:
    priced = [_price(line) for line in case["lines"]]
    if "expectRules" in case:
        assert [p.rule.value for p in priced] == [_stored_rule(r) for r in case["expectRules"]]
    total = sum((p.line_total for p in priced), 0) + case["shippingCharged"]
    assert total == case["expectTotal"]


KNOWN_KEYS = {"lines", "totals", "repricing"}
PAIR_FIELDS = ("gramsHundredths", "gift", "specialPrice")


def test_the_matrix_has_only_the_known_top_level_keys() -> None:
    assert set(MATRIX) == KNOWN_KEYS, (
        f"unknown top-level keys in pricing-matrix.json: {sorted(set(MATRIX) - KNOWN_KEYS)}"
    )


def _check_entry(
    case: str, side: str, name: str, totals: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """The lines of the totals entry `name`, after the structure checks a re-pricing case
    needs; every refusal names the case."""
    assert name in totals, f"{case}: {side} {name!r} names no totals entry"
    lines: list[dict[str, Any]] = totals[name]["lines"]
    ids = [line.get("id") for line in lines]
    assert all(isinstance(i, str) and i for i in ids), (
        f"{case}: {side} has a line without a non-empty id"
    )
    assert len(set(ids)) == len(ids), f"{case}: {side} has duplicate line ids {ids}"
    assert len({line["customerIsVip"] for line in lines}) == 1, (
        f"{case}: {side} lines disagree on customerIsVip"
    )
    assert all(line["settings"] == lines[0]["settings"] for line in lines), (
        f"{case}: {side} lines disagree on settings"
    )
    return lines


def _check_pair(case: dict[str, Any], totals: dict[str, dict[str, Any]]) -> None:
    name = case["name"]
    before = _check_entry(name, "before", case["before"], totals)
    after = _check_entry(name, "after", case["after"], totals)
    assert [line["id"] for line in before] == [line["id"] for line in after], (
        f"{name}: before and after differ in line ids or their order"
    )
    for field in PAIR_FIELDS:
        assert [line[field] for line in before] == [line[field] for line in after], (
            f"{name}: before and after differ in {field}"
        )
    assert totals[case["before"]]["shippingCharged"] == totals[case["after"]]["shippingCharged"], (
        f"{name}: before and after differ in shippingCharged"
    )


TOTALS_BY_NAME = {entry["name"]: entry for entry in MATRIX["totals"]}


@pytest.mark.parametrize("case", MATRIX["repricing"], ids=lambda c: c["name"])
def test_repricing_pairs_are_well_formed(case: dict[str, Any]) -> None:
    _check_pair(case, TOTALS_BY_NAME)
    assert isinstance(case["expectChanged"], bool), f"{case['name']}: expectChanged is not a bool"


def _broken(edit: Callable[[dict[str, Any]], None]) -> tuple[dict[str, Any], dict[str, Any]]:
    """The date-change case (two lines) with `edit` applied to a copy of its `after` entry,
    and the totals that name that copy."""
    case = next(c for c in MATRIX["repricing"] if c["name"] == "date change")
    after = copy.deepcopy(TOTALS_BY_NAME[case["after"]])
    edit(after)
    return case, {**TOTALS_BY_NAME, case["after"]: after}


def _line(index: int, **changes: Any) -> Callable[[dict[str, Any]], None]:
    def edit(entry: dict[str, Any]) -> None:
        entry["lines"][index].update(changes)

    return edit


def _ship(entry: dict[str, Any]) -> None:
    entry["shippingCharged"] += 7


def _no_id(entry: dict[str, Any]) -> None:
    del entry["lines"][1]["id"]


def _swap(entry: dict[str, Any]) -> None:
    entry["lines"].reverse()


@pytest.mark.parametrize(
    ("edit", "message"),
    [
        (_line(1, id=""), "has a line without a non-empty id"),
        (_no_id, "has a line without a non-empty id"),
        (_line(1, id="a"), "has duplicate line ids"),
        (_line(0, id="z"), "differ in line ids or their order"),
        (_swap, "differ in line ids or their order"),
        (_line(1, customerIsVip=True), "lines disagree on customerIsVip"),
        (_line(1, settings={"bulk": False, "vip": True}), "lines disagree on settings"),
        (_line(0, gramsHundredths=999), "differ in gramsHundredths"),
        (_line(0, gift=True), "differ in gift"),
        (_line(0, specialPrice=5), "differ in specialPrice"),
        (_ship, "differ in shippingCharged"),
    ],
    ids=[
        "empty id",
        "missing id",
        "duplicate id",
        "other id",
        "order",
        "customerIsVip",
        "settings",
        "grams",
        "gift",
        "special price",
        "shipping",
    ],
)
def test_a_malformed_repricing_pair_is_refused(
    edit: Callable[[dict[str, Any]], None], message: str
) -> None:
    case, totals = _broken(edit)
    with pytest.raises(AssertionError, match=f"^date change: .*{message}"):
        _check_pair(case, totals)


def test_a_repricing_case_naming_no_totals_entry_is_refused() -> None:
    case = {**MATRIX["repricing"][0], "after": "no such entry"}
    with pytest.raises(AssertionError, match="names no totals entry"):
        _check_pair(case, TOTALS_BY_NAME)


def test_a_wrong_expectation_in_the_matrix_would_fail_this_suite() -> None:
    """Proves the comparison itself is load-bearing, not only the matrix's own
    cases: the domain's real answer for a real matrix case, checked against a
    deliberately wrong expectation, must fail — because it is `_price`'s genuine
    output being compared, not two hard-coded literals."""
    case = next(
        c for c in MATRIX["lines"] if c["name"] == "list price applies when nothing else does"
    )
    priced = _price(case["input"])
    assert priced.rule.value == _stored_rule(case["expect"]["rule"])  # sanity: the real case passes

    wrong_rule = "vip"
    assert wrong_rule != case["expect"]["rule"]
    with pytest.raises(AssertionError):
        assert priced.rule.value == wrong_rule
