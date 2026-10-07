"""The front's hand-written fixtures (`web/src/api/fixtures/`) are the contract for
every new or changed response (plan, "Fixtures"): one JSON file per shape, with literal
enum values, that the backend subtask serving a route checks its real `TestClient`
answers against, and that the front's `fetch` fakes import.

`assert_matches_fixture` is the one checker both sides share. It never compares values
(a fixture's `"balance": 15000` does not pin the real figure) — only that an answer has
exactly the fixture's keys, each holding the same JSON type: a JSON `integer` is a
Python `int` that is not a `bool`, a JSON `number` is a Python `float`, and the two
never meet, money being whole pesos (ADR-0001) and grams a decimal (CODING_STANDARDS
§10). `null` matches only where `tests/contract_nullable.py`'s `NULLABLE` declares that
field nullable — on either side: an answer `null` the fixture never declares, or a
fixture `null` the declaration never names, both fail the check, and a declared object
or array (`ShapeOf`) is checked recursively against the shape it points at, with the
same strict rules.

A fixture may itself be a list (`movements.json`): its paths start at `[kind]`. A list is matched item by item against the fixture's own single representative entry,
unless every fixture item carries `"kind"` (`AccountRow`'s three shapes) — then each
answer item is matched against the fixture item sharing its own `kind`, and a `kind`
the fixture never lists fails the check. An empty fixture list cannot describe an
item's shape, so only "the answer is a list" is checked.

Known limit: a referenced shape (`ShapeOf`) is checked against one example.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Literal

from tests.contract_nullable import NULLABLE, JsonType, ShapeOf

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "web" / "src" / "api" / "fixtures"

Nullable = Mapping[str, JsonType | ShapeOf]


def _load_fixture(name: str) -> object:
    return json.loads((FIXTURES_DIR / f"{name}.json").read_text())


def assert_matches_fixture(answer: object, name: str) -> None:
    """Raises `AssertionError` unless `answer` has exactly the keys and JSON types of
    `web/src/api/fixtures/{name}.json`, recursively, with nullability governed by
    `NULLABLE[name]`. This is the enforcement artefact `tests/test_contract_shapes.py`
    exercises on bad input, not only on a real answer."""
    check_shape(_load_fixture(name), answer, NULLABLE.get(name, {}))


def check_shape(fixture: object, answer: object, nullable: Nullable) -> None:
    """The checker `assert_matches_fixture` wraps, taking the fixture and its
    nullability declaration directly so this module's own tests can exercise it over
    small inline fixtures, never only the committed ones."""
    _validate_declarations(fixture, nullable)
    _check_shape(fixture, answer, "", nullable)


def _child_path(path: str, key: str) -> str:
    return f"{path}.{key}" if path else key


def _check_shape(expected: object, actual: object, path: str, nullable: Nullable) -> None:
    if expected is None:
        declared = nullable.get(path)
        if declared is None:
            raise AssertionError(f"{path}: the fixture is null here, not declared in NULLABLE")
        if actual is None:
            return
        _check_declared(declared, actual, path, nullable)
        return
    if actual is None:
        if path not in nullable:
            raise AssertionError(f"{path}: the answer is null, not declared nullable")
        return
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            raise AssertionError(f"{path}: expected an object, got {_json_type(actual)}")
        missing = expected.keys() - actual.keys()
        if missing:
            raise AssertionError(f"{path}: missing {sorted(missing)}")
        extra = actual.keys() - expected.keys()
        if extra:
            raise AssertionError(f"{path}: has extra keys {sorted(extra)}")
        for key, expected_value in expected.items():
            _check_shape(expected_value, actual[key], _child_path(path, key), nullable)
        return
    if isinstance(expected, list):
        if not isinstance(actual, list):
            raise AssertionError(f"{path}: expected an array, got {_json_type(actual)}")
        _check_items(expected, actual, path, nullable)
        return
    if isinstance(expected, bool):
        if not isinstance(actual, bool):
            raise AssertionError(f"{path}: expected a boolean, got {_json_type(actual)}")
        return
    if isinstance(expected, int):
        if isinstance(actual, bool) or not isinstance(actual, int):
            raise AssertionError(f"{path}: expected an integer, got {_json_type(actual)}")
        return
    if isinstance(expected, float):
        if isinstance(actual, bool) or not isinstance(actual, float):
            raise AssertionError(f"{path}: expected a number, got {_json_type(actual)}")
        return
    if isinstance(expected, str):
        if not isinstance(actual, str):
            raise AssertionError(f"{path}: expected a string, got {_json_type(actual)}")
        return
    raise AssertionError(f"{path}: the fixture itself has an unsupported type")


def _check_declared(
    declared: JsonType | ShapeOf, actual: object, path: str, nullable: Nullable
) -> None:
    if isinstance(declared, ShapeOf):
        _check_shape(_resolve_shape_of(declared), actual, path, nullable)
        return
    if not _matches_json_type(declared, actual):
        raise AssertionError(
            f"{path}: declared {declared!r} (nullable), got {_json_type(actual)}"
        )


def _check_items(
    expected: list[object], actual: list[object], path: str, nullable: Nullable
) -> None:
    if not expected:
        return  # an empty fixture list describes no item shape to check against.
    by_kind = _group_by_kind(expected)
    for item in actual:
        if by_kind is None:
            _check_shape(expected[0], item, f"{path}[]", nullable)
            continue
        if not isinstance(item, dict) or "kind" not in item:
            raise AssertionError(f"{path}[]: expected an object with 'kind'")
        kind = item["kind"]
        if kind not in by_kind:
            raise AssertionError(f"{path}[]: {kind!r} is not a kind the fixture lists")
        _check_shape(by_kind[kind], item, f"{path}[{kind}]", nullable)


def _group_by_kind(items: list[object]) -> dict[object, object] | None:
    """`items` keyed by its own `"kind"`, if every one of them is an object carrying
    one (`AccountRow`'s sale/payment/credit shapes) — else `None`, meaning every item
    shares the list's single representative shape."""
    if not all(isinstance(item, dict) and "kind" in item for item in items):
        return None
    by_kind: dict[object, object] = {}
    for item in items:
        assert isinstance(item, dict)
        by_kind[item["kind"]] = item
    return by_kind


# -- the nullability declaration's own consistency, checked against the fixture ------


def _validate_declarations(fixture: object, nullable: Nullable) -> None:
    for path, declared in nullable.items():
        if declared in ("object", "array"):
            raise AssertionError(
                f"{path}: a nullable object/array must be declared with ShapeOf, "
                f"never a bare {declared!r}"
            )
        status, value = _lookup_path(fixture, path)
        if status == "missing":
            raise AssertionError(f"{path}: declared nullable but missing from the fixture")
        if status == "null_ancestor":
            # A field further up `path` is itself null in this fixture, so `path`
            # has nothing to check here; the sibling fixture a `ShapeOf` for that
            # ancestor points at is the one that shows it, and this path, non-null.
            continue
        if isinstance(declared, ShapeOf):
            _resolve_shape_of(declared)  # raises if that target is missing or null
            if value is not None and not isinstance(value, dict | list):
                raise AssertionError(
                    f"{path}: declared with ShapeOf but the fixture's own value is "
                    f"{_json_type(value)}, neither an object nor an array"
                )
        elif value is not None and not _matches_json_type(declared, value):
            raise AssertionError(
                f"{path}: declared {declared!r} disagrees with the fixture's own "
                f"{_json_type(value)}"
            )


def _resolve_shape_of(declared: ShapeOf) -> object:
    target = _load_fixture(declared.fixture)
    status, value = _lookup_path(target, declared.path)
    if status != "found" or value is None:
        raise AssertionError(
            f"ShapeOf({declared.fixture!r}, {declared.path!r}): that target is "
            "missing or null"
        )
    return value


_Found = Literal["found", "missing", "null_ancestor"]


def _lookup_path(root: object, path: str) -> tuple[_Found, object]:
    """Walks `path` (`a.b`, `lines[]`, `rows[payment]`) over `root` — `lines[]` picks
    a plain list's first item, `rows[payment]` the item carrying that `kind`. Answers
    `"found"` with the value there, `"missing"` when a key or kind along the way is
    simply absent, or `"null_ancestor"` when a field further up the path is itself
    `null`, leaving nothing nested to find — not the same failure, since a `ShapeOf`
    elsewhere may be exactly the fixture that shows that ancestor non-null."""
    current = root
    segments = path.split(".")
    for segment in segments:
        if current is None:
            return "null_ancestor", None
        name, index = _parse_segment(segment)
        if name == "" and index is not None and isinstance(current, list):
            pass  # a fixture that is itself a list: the segment indexes the root.
        elif not isinstance(current, dict) or name not in current:
            return "missing", None
        else:
            current = current[name]
        if index is None:
            continue
        if current is None:
            return "null_ancestor", None
        if not isinstance(current, list):
            return "missing", None
        if index == "":
            if not current:
                return "missing", None
            current = current[0]
            continue
        match = next(
            (item for item in current if isinstance(item, dict) and item.get("kind") == index),
            None,
        )
        if match is None:
            return "missing", None
        current = match
    return "found", current


def _parse_segment(segment: str) -> tuple[str, str | None]:
    if not segment.endswith("]"):
        return segment, None
    name, _, rest = segment[:-1].partition("[")
    return name, rest


def _matches_json_type(declared: JsonType, value: object) -> bool:
    if declared == "string":
        return isinstance(value, str)
    if declared == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if declared == "number":
        return isinstance(value, bool) is False and isinstance(value, float)
    if declared == "boolean":
        return isinstance(value, bool)
    if declared == "object":
        return isinstance(value, dict)
    return isinstance(value, list)  # declared == "array"


def _json_type(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__
