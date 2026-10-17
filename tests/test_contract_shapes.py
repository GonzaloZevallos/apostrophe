"""`assert_matches_fixture` (plan, "Fixtures") is the one checker both the backend
subtask serving a new or changed response and the front's `fetch` fakes rely on to stay
in step with `web/src/api/fixtures/`. These tests exercise it directly, over the real
fixtures this subtask adds, proving it both accepts a conforming answer and rejects the
ways one can drift from its fixture (CODING_STANDARDS.md section 5: a checker is proven
on bad input, not only on the good one it is meant to pass).

The second half proves `tests/contract_nullable.py`'s own `NULLABLE`, and `FIXTURE_ROUTES`
below, stay true to `app.openapi()`: every nullable field of every route a fixture
describes, and only those, is declared."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI

from tests.contract_nullable import NULLABLE, JsonType, ShapeOf
from tests.contract_shapes import (
    FIXTURES_DIR,
    _resolve_shape_of,
    assert_matches_fixture,
    check_shape,
)


def _load(name: str) -> dict[str, object]:
    loaded = json.loads((FIXTURES_DIR / f"{name}.json").read_text())
    assert isinstance(loaded, dict)
    return loaded


def test_the_fixture_directory_is_where_the_front_keeps_its_fixtures() -> None:
    assert FIXTURES_DIR == Path("web/src/api/fixtures").resolve()


def test_an_answer_with_the_same_keys_and_types_matches_regardless_of_its_values() -> None:
    debtors = _load("debtors")
    answer = {
        "total_owed": 9000,
        "sales_owing_count": 1,
        "debtors": [
            {
                "customer": {"id": 7, "name": "Beto Gómez"},
                "balance": 9000,
                "owing_since": "2026-08-01",
                "standing": "owes",
            }
        ],
    }

    assert_matches_fixture(answer, "debtors")
    assert debtors != answer  # proves the check is not comparing to the fixture's own values


def test_a_declared_null_passes_on_either_side() -> None:
    settled = _load("customer") | {"balance": 0, "owing_since": None, "standing": "settled"}

    assert_matches_fixture(settled, "customer")  # fixture's channel non-null, answer's null
    assert_matches_fixture(_load("customer"), "customer")  # both non-null


def test_a_missing_key_fails_the_checker() -> None:
    broken = _load("customer")
    del broken["balance"]

    with pytest.raises(AssertionError, match="balance"):
        assert_matches_fixture(broken, "customer")


def test_an_extra_key_fails_the_checker() -> None:
    broken = _load("customer") | {"unexpected": True}

    with pytest.raises(AssertionError, match="unexpected"):
        assert_matches_fixture(broken, "customer")


def test_a_field_of_the_wrong_json_type_fails_the_checker() -> None:
    broken = _load("debtors") | {"total_owed": "9000"}

    with pytest.raises(AssertionError, match="total_owed"):
        assert_matches_fixture(broken, "debtors")


def test_a_bare_object_in_place_of_an_array_fails_the_checker() -> None:
    broken = _load("debtors") | {"debtors": {}}

    with pytest.raises(AssertionError, match="debtors"):
        assert_matches_fixture(broken, "debtors")


def test_account_rows_are_matched_by_their_own_kind_not_by_position() -> None:
    # Two sale rows and no credit row at all: a plain "match item 0 against item 0"
    # checker would wrongly compare a sale row to the fixture's payment row.
    answer = {
        "balance": 11000,
        "owing_since": "2026-09-14",
        "standing": "owes",
        "rows": [
            {
                "kind": "sale",
                "date": "2026-09-01",
                "running_balance": 4000,
                "standing": "owes",
                "sale": {"id": 1, "total": 4000, "how_paid": "none"},
            },
            {
                "kind": "sale",
                "date": "2026-09-14",
                "running_balance": 11000,
                "standing": "owes",
                "sale": {"id": 2, "total": 7000, "how_paid": "transfer"},
            },
        ],
    }

    assert_matches_fixture(answer, "account")


def test_a_row_kind_the_fixture_never_lists_fails_the_checker() -> None:
    broken = _load("account")
    rows = broken["rows"]
    assert isinstance(rows, list)
    rows.append({**rows[0], "kind": "refund"})

    with pytest.raises(AssertionError, match="refund"):
        assert_matches_fixture(broken, "account")


def test_a_fixture_that_is_a_list_rejects_a_wrong_kind_a_stray_key_and_an_undeclared_null() -> None:
    movements = json.loads((FIXTURES_DIR / "movements.json").read_text())
    assert isinstance(movements, list)
    withdrawal = movements[1]

    assert_matches_fixture(movements, "movements")
    with pytest.raises(AssertionError, match="refund"):
        assert_matches_fixture([{**withdrawal, "kind": "refund"}], "movements")
    with pytest.raises(AssertionError, match="extra keys"):
        assert_matches_fixture([{**withdrawal, "variety_id": 1}], "movements")
    with pytest.raises(AssertionError, match="not declared nullable"):
        assert_matches_fixture([{**withdrawal, "grams": None}], "movements")
    with pytest.raises(AssertionError, match="missing from the fixture"):
        check_shape(movements, movements, {"[entry].no_such_field": "string"})


def test_an_empty_fixture_list_only_checks_that_the_answer_is_a_list() -> None:
    answer = _load("debtors") | {"debtors": []}

    # The real fixture's own `debtors` list is not empty, so this proves the emptied
    # answer still matches: an empty list carries no item shape to check against.
    assert_matches_fixture(answer, "debtors")


# -- integer vs number, and null tightened to what NULLABLE declares -----------------


def test_a_float_in_an_integer_field_fails_the_checker() -> None:
    broken = _load("customer") | {"balance": 15000.0}

    with pytest.raises(AssertionError, match="balance"):
        assert_matches_fixture(broken, "customer")


def test_an_int_in_a_number_field_fails_the_checker() -> None:
    broken = _load("sale-detail") | {"total_grams": 4}

    with pytest.raises(AssertionError, match="total_grams"):
        assert_matches_fixture(broken, "sale-detail")


def test_an_undeclared_null_in_the_answer_fails_the_checker() -> None:
    broken = _load("customer") | {"balance": None}

    with pytest.raises(AssertionError, match="balance"):
        assert_matches_fixture(broken, "customer")


def test_a_declared_nullable_field_answered_with_the_wrong_type_fails_the_checker() -> None:
    # account.json's own `owing_since` is null; NULLABLE declares it a string.
    broken = _load("account") | {"owing_since": {"not": "a string"}}

    with pytest.raises(AssertionError, match="owing_since"):
        assert_matches_fixture(broken, "account")


def test_an_undeclared_null_in_the_fixture_fails_the_checker() -> None:
    with pytest.raises(AssertionError, match="foo"):
        check_shape({"foo": None}, {"foo": None}, {})


def test_a_declared_path_missing_from_the_fixture_fails_the_checker() -> None:
    with pytest.raises(AssertionError, match="bar"):
        check_shape({}, {}, {"bar": "string"})


def test_a_declared_type_disagreeing_with_a_non_null_fixture_value_fails_the_checker() -> None:
    with pytest.raises(AssertionError, match="foo"):
        check_shape({"foo": 123}, {"foo": 123}, {"foo": "string"})


def test_a_bare_object_nullable_declaration_fails_the_checker() -> None:
    with pytest.raises(AssertionError, match="foo"):
        check_shape({"foo": {"a": 1}}, {"foo": {"a": 1}}, {"foo": "object"})


def test_a_bare_array_nullable_declaration_fails_the_checker() -> None:
    with pytest.raises(AssertionError, match="foo"):
        check_shape({"foo": [1]}, {"foo": [1]}, {"foo": "array"})


def test_a_shape_of_target_that_is_null_fails_the_checker() -> None:
    # account.json's own `owing_since` is null: not a valid ShapeOf target.
    with pytest.raises(AssertionError, match="owing_since"):
        check_shape({"foo": None}, {"foo": None}, {"foo": ShapeOf("account", "owing_since")})


def test_a_shape_of_target_that_is_missing_fails_the_checker() -> None:
    with pytest.raises(AssertionError, match="nope"):
        check_shape({"foo": None}, {"foo": None}, {"foo": ShapeOf("account", "nope")})


def test_a_shape_of_field_answered_with_an_object_missing_a_key_fails_the_checker() -> None:
    # NULLABLE["pinnedCatalogTest"]["status"] points at pinnedCatalog's own `status`,
    # which carries `last_published_on`; an answer leaving it out must fail.
    broken = _load("pinnedCatalogTest") | {
        "status": {"state": "out_of_date", "reason": "telegram_unreachable"}
    }

    with pytest.raises(AssertionError, match="last_published_on"):
        assert_matches_fixture(broken, "pinnedCatalogTest")


# -- FIXTURE_ROUTES / NULLABLE kept true to app.openapi() ----------------------------


@dataclass(frozen=True)
class RouteShape:
    method: str
    path: str
    item: bool = False


FIXTURE_ROUTES: Mapping[str, tuple[RouteShape, ...]] = {
    "account": (RouteShape("GET", "/customers/{customer_id}/account"),),
    "analysis": (RouteShape("GET", "/analysis"),),
    "analysis-empty": (RouteShape("GET", "/analysis"),),
    "customer": (
        RouteShape("POST", "/customers"),
        RouteShape("GET", "/customers/{customer_id}"),
        RouteShape("GET", "/customers", item=True),
    ),
    "customer-no-phone": (
        RouteShape("POST", "/customers"),
        RouteShape("GET", "/customers/{customer_id}"),
        RouteShape("GET", "/customers", item=True),
    ),
    "debtors": (RouteShape("GET", "/payments/debtors"),),
    "firstRun": (RouteShape("GET", "/first-run"),),
    "movements": (RouteShape("GET", "/stock/varieties/{variety_id}/movements"),),
    "panel": (RouteShape("GET", "/panel"),),
    "payment": (RouteShape("POST", "/customers/{customer_id}/payments"),),
    "payment-preview": (RouteShape("POST", "/customers/{customer_id}/payments/preview"),),
    "pinnedCatalog": (RouteShape("POST", "/pinned-catalog/publish"),),
    "pinnedCatalogStatus": (RouteShape("GET", "/pinned-catalog/status"),),
    "pinnedCatalogTest": (RouteShape("POST", "/pinned-catalog/test"),),
    "sale": (
        RouteShape("POST", "/sales"),
        RouteShape("GET", "/sales", item=True),
    ),
    "sale-detail": (RouteShape("GET", "/sales/{sale_id}"),),
    "sale-detail-gift": (RouteShape("GET", "/sales/{sale_id}"),),
    "withdrawal": (
        RouteShape("POST", "/stock/withdrawals"),
        RouteShape("GET", "/stock/withdrawals/{withdrawal_id}"),
        RouteShape("PUT", "/stock/withdrawals/{withdrawal_id}"),
    ),
}


def test_fixture_routes_keys_match_the_fixture_files() -> None:
    stems = {path.stem for path in FIXTURES_DIR.glob("*.json")}

    assert set(FIXTURE_ROUTES.keys()) == stems


def test_every_fixture_has_at_least_one_route() -> None:
    for name, routes in FIXTURE_ROUTES.items():
        assert routes, f"{name} has no RouteShape at all"


def _deref(schema: dict[str, Any], components: dict[str, Any]) -> dict[str, Any]:
    while "$ref" in schema:
        name = schema["$ref"].rsplit("/", 1)[-1]
        schema = components[name]
    return schema


def _leaf_type(schema: dict[str, Any]) -> JsonType:
    type_ = schema.get("type")
    if type_ == "object":
        return "object"
    if type_ == "array":
        return "array"
    if type_ == "string":
        return "string"
    if type_ == "integer":
        return "integer"
    if type_ == "number":
        return "number"
    if type_ == "boolean":
        return "boolean"
    if "properties" in schema:
        return "object"
    raise AssertionError(f"cannot classify as a JSON type: {schema}")


def _kind_const(schema: dict[str, Any]) -> str | None:
    kind_schema = schema.get("properties", {}).get("kind")
    if kind_schema is None:
        return None
    const = kind_schema.get("const")
    return const if isinstance(const, str) else None


def _walk(
    schema: dict[str, Any], components: dict[str, Any], prefix: str, acc: dict[str, JsonType]
) -> None:
    schema = _deref(schema, components)
    if "anyOf" in schema:
        variants = [_deref(variant, components) for variant in schema["anyOf"]]
        non_null = [variant for variant in variants if variant.get("type") != "null"]
        has_null = len(non_null) < len(variants)
        if has_null and len(non_null) == 1:
            other = non_null[0]
            acc[prefix] = _leaf_type(other)
            _walk_object_or_array(other, components, prefix, acc)
        # A non-null union of several types (e.g. "payment"): nothing to walk, since
        # none of this product's unions mixes in an object or array alternative.
        return
    _walk_object_or_array(schema, components, prefix, acc)


def _walk_object_or_array(
    schema: dict[str, Any], components: dict[str, Any], prefix: str, acc: dict[str, JsonType]
) -> None:
    schema = _deref(schema, components)
    if schema.get("type") == "array" or "items" in schema:
        _walk_array(schema["items"], components, prefix, acc)
        return
    if schema.get("type") == "object" or "properties" in schema:
        for key, child in schema.get("properties", {}).items():
            child_prefix = f"{prefix}.{key}" if prefix else key
            _walk(child, components, child_prefix, acc)


def _walk_array(
    items_schema: dict[str, Any], components: dict[str, Any], prefix: str, acc: dict[str, JsonType]
) -> None:
    if "anyOf" in items_schema:
        variants = [_deref(variant, components) for variant in items_schema["anyOf"]]
        if all(_kind_const(variant) is not None for variant in variants):
            for variant in variants:
                kind = _kind_const(variant)
                _walk_object_or_array(variant, components, f"{prefix}[{kind}]", acc)
            return
    _walk(items_schema, components, f"{prefix}[]", acc)


def _response_schema(spec: dict[str, Any], route: RouteShape) -> dict[str, Any]:
    operation = spec["paths"][route.path][route.method.lower()]
    responses = operation["responses"]
    body = next(responses[code] for code in ("200", "201") if code in responses)
    schema: dict[str, Any] = body["content"]["application/json"]["schema"]
    return schema["items"] if route.item else schema


def _declared_json_types(name: str) -> dict[str, JsonType]:
    return {
        path: (_shape_of_type(declared) if isinstance(declared, ShapeOf) else declared)
        for path, declared in NULLABLE.get(name, {}).items()
    }


def _shape_of_type(declared: ShapeOf) -> JsonType:
    """What a `ShapeOf` field is in the OpenAPI document: an array when its target is a
    list (`firstRun`'s `checklist`), an object otherwise."""
    return "array" if isinstance(_resolve_shape_of(declared), list) else "object"


def test_every_fixture_routes_nullable_fields_match_openapi(app: FastAPI) -> None:
    spec = app.openapi()
    components = spec["components"]["schemas"]
    for name, routes in FIXTURE_ROUTES.items():
        declared = _declared_json_types(name)
        for route in routes:
            found: dict[str, JsonType] = {}
            _walk(_response_schema(spec, route), components, "", found)
            assert found == declared, f"{name} {route}: openapi={found} NULLABLE={declared}"


def test_a_nullable_array_declared_with_shape_of_is_an_array_in_the_declared_types() -> None:
    assert _declared_json_types("firstRun") == {"checklist": "array"}
    assert _declared_json_types("pinnedCatalogStatus")["status"] == "object"


def test_a_nullable_array_answered_with_the_wrong_type_or_a_wrong_item_fails_the_checker() -> None:
    assert_matches_fixture(_load("firstRun") | {"checklist": None}, "firstRun")
    with pytest.raises(AssertionError, match="checklist"):
        assert_matches_fixture(_load("firstRun") | {"checklist": "none"}, "firstRun")
    with pytest.raises(AssertionError, match="done"):
        assert_matches_fixture(
            _load("firstRun") | {"checklist": [{"step": "priced_variety", "required": True}]},
            "firstRun",
        )


# -- the walker itself, proven on schemas a wrong NULLABLE must disagree with --------


def _walked(
    schema: dict[str, Any], *, components: dict[str, Any] | None = None
) -> dict[str, JsonType]:
    found: dict[str, JsonType] = {}
    _walk(schema, components or {}, "", found)
    return found


def _assert_declared_matches_schema(
    schema: dict[str, Any],
    declared: dict[str, JsonType],
    *,
    components: dict[str, Any] | None = None,
) -> None:
    """The same comparison `test_every_fixture_routes_nullable_fields_match_openapi`
    makes for a real route, isolated so a wrong `declared` can be shown to fail it
    over a small inline schema, never only the real ones that already agree."""
    assert _walked(schema, components=components) == declared


_NULLABLE_STRING_FIELD = {
    "type": "object",
    "properties": {"foo": {"anyOf": [{"type": "string"}, {"type": "null"}]}},
}

# A `kind`-discriminated array, the same shape `AccountRowOut`'s three variants take:
# only the "sale" kind carries a nullable field, at "note".
_KIND_DISCRIMINATED_ROWS = {
    "type": "object",
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "anyOf": [
                    {
                        "type": "object",
                        "properties": {
                            "kind": {"type": "string", "const": "sale"},
                            "note": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        },
                    },
                    {
                        "type": "object",
                        "properties": {"kind": {"type": "string", "const": "payment"}},
                    },
                ]
            },
        }
    },
}


def test_the_walker_finds_a_nullable_field_behind_any_of_null() -> None:
    assert _walked(_NULLABLE_STRING_FIELD) == {"foo": "string"}


def test_a_nullable_path_missing_from_the_declaration_fails_the_equality_check() -> None:
    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(_NULLABLE_STRING_FIELD, {})


def test_an_extra_declared_path_the_schema_never_shows_fails_the_equality_check() -> None:
    not_nullable = {"type": "object", "properties": {"foo": {"type": "string"}}}

    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(not_nullable, {"foo": "string"})


def test_the_walker_finds_a_nullable_field_inside_its_own_kind_discriminated_item() -> None:
    assert _walked(_KIND_DISCRIMINATED_ROWS) == {"rows[sale].note": "string"}


def test_a_nullable_field_inside_a_kind_item_missing_from_the_declaration_fails() -> None:
    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(_KIND_DISCRIMINATED_ROWS, {})


def test_a_kind_item_s_nullable_field_declared_under_the_wrong_kind_fails() -> None:
    # "payment" carries no nullable field at all; the walker must not confuse the
    # two variants' own paths with each other.
    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(_KIND_DISCRIMINATED_ROWS, {"rows[payment].note": "string"})


# -- the walker's own _deref, behind a $ref nested in a nullable anyOf ---------------

# `X` sits neither first nor last, with a decoy carrying its own nullable field on
# each side (`Y` before, `Z` after), so a `_deref` that picked the first or the last
# component, or stopped short of the real indirection, would walk one of them instead.
COMPONENTS: dict[str, Any] = {
    "Y": {
        "type": "object",
        "properties": {"y": {"anyOf": [{"type": "string"}, {"type": "null"}]}},
    },
    # `A` only redirects to `X`: resolving the schema's own `$ref` takes two hops.
    "A": {"$ref": "#/components/schemas/X"},
    "X": {
        "type": "object",
        "properties": {
            "nested": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "required_field": {"type": "integer"},
        },
    },
    "Z": {
        "type": "object",
        "properties": {"z": {"anyOf": [{"type": "string"}, {"type": "null"}]}},
    },
}

_REF_BEHIND_NULLABLE_ANY_OF = {
    "type": "object",
    "properties": {
        "x": {"anyOf": [{"$ref": "#/components/schemas/A"}, {"type": "null"}]},
    },
}


def test_the_walker_resolves_a_ref_behind_a_nullable_any_of() -> None:
    assert _walked(_REF_BEHIND_NULLABLE_ANY_OF, components=COMPONENTS) == {
        "x": "object",
        "x.nested": "string",
    }


def test_a_nested_path_behind_a_deref_d_ref_missing_from_the_declaration_fails() -> None:
    # Pinned first: if `_deref` stopped short of `X` (or didn't resolve at all), the
    # walk itself would raise "cannot classify" here, never reaching the `raises` below.
    assert _walked(_REF_BEHIND_NULLABLE_ANY_OF, components=COMPONENTS) == {
        "x": "object",
        "x.nested": "string",
    }

    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(
            _REF_BEHIND_NULLABLE_ANY_OF, {"x": "object"}, components=COMPONENTS
        )


def test_an_extra_declared_path_behind_a_deref_d_ref_fails() -> None:
    assert _walked(_REF_BEHIND_NULLABLE_ANY_OF, components=COMPONENTS) == {
        "x": "object",
        "x.nested": "string",
    }

    # `X`'s own `required_field` is not nullable; the walker never reports it.
    wrong: dict[str, JsonType] = {
        "x": "object",
        "x.nested": "string",
        "x.required_field": "integer",
    }
    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(_REF_BEHIND_NULLABLE_ANY_OF, wrong, components=COMPONENTS)


def test_a_path_behind_a_deref_d_ref_declared_the_wrong_json_type_fails() -> None:
    assert _walked(_REF_BEHIND_NULLABLE_ANY_OF, components=COMPONENTS) == {
        "x": "object",
        "x.nested": "string",
    }

    wrong: dict[str, JsonType] = {"x": "string", "x.nested": "string"}
    with pytest.raises(AssertionError):
        _assert_declared_matches_schema(_REF_BEHIND_NULLABLE_ANY_OF, wrong, components=COMPONENTS)
