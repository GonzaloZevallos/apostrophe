"""The front's hand-written fixtures (`web/src/api/fixtures/`) are the contract for
every new or changed response (plan, "Fixtures"): one JSON file per shape, with literal
enum values, that the backend subtask serving a route checks its real `TestClient`
answers against, and that the front's `fetch` fakes import.

`assert_matches_fixture` is the one checker both sides share. It never compares values
(a fixture's `"balance": 15000` does not pin the real figure) — only that an answer has
exactly the fixture's keys, each holding the same JSON type. `null` matches any type in
either direction, since a fixture can only show one example of an optional field
(`owing_since` is a string here, `null` once nothing is owed).

A list is matched item by item against the fixture's own single representative entry,
unless every fixture item carries `"kind"` (`AccountRow`'s three shapes) — then each
answer item is matched against the fixture item sharing its own `kind`, and a `kind`
the fixture never lists fails the check. An empty fixture list cannot describe an
item's shape, so only "the answer is a list" is checked.
"""

import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "web" / "src" / "api" / "fixtures"


def assert_matches_fixture(answer: object, name: str) -> None:
    """Raises `AssertionError` unless `answer` has exactly the keys and JSON types of
    `web/src/api/fixtures/{name}.json`, recursively. This is the enforcement artefact
    `tests/test_contract_shapes.py` exercises on bad input, not only on a real answer."""
    fixture = json.loads((FIXTURES_DIR / f"{name}.json").read_text())
    _check_shape(fixture, answer, name)


def _check_shape(expected: object, actual: object, path: str) -> None:
    if expected is None or actual is None:
        return  # null stands for any type of an optional field, on either side.
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
            _check_shape(expected_value, actual[key], f"{path}.{key}")
        return
    if isinstance(expected, list):
        if not isinstance(actual, list):
            raise AssertionError(f"{path}: expected an array, got {_json_type(actual)}")
        _check_items(expected, actual, path)
        return
    if isinstance(expected, bool):
        if not isinstance(actual, bool):
            raise AssertionError(f"{path}: expected a boolean, got {_json_type(actual)}")
        return
    if isinstance(expected, int | float):
        if isinstance(actual, bool) or not isinstance(actual, int | float):
            raise AssertionError(f"{path}: expected a number, got {_json_type(actual)}")
        return
    if isinstance(expected, str):
        if not isinstance(actual, str):
            raise AssertionError(f"{path}: expected a string, got {_json_type(actual)}")
        return
    raise AssertionError(f"{path}: the fixture itself has an unsupported type")


def _check_items(expected: list[object], actual: list[object], path: str) -> None:
    if not expected:
        return  # an empty fixture list describes no item shape to check against.
    by_kind = _group_by_kind(expected)
    for index, item in enumerate(actual):
        if by_kind is None:
            _check_shape(expected[0], item, f"{path}[{index}]")
            continue
        if not isinstance(item, dict) or "kind" not in item:
            raise AssertionError(f"{path}[{index}]: expected an object with 'kind'")
        kind = item["kind"]
        if kind not in by_kind:
            raise AssertionError(f"{path}[{index}]: {kind!r} is not a kind the fixture lists")
        _check_shape(by_kind[kind], item, f"{path}[{index}]")


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


def _json_type(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int | float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__
