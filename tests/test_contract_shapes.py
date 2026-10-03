"""`assert_matches_fixture` (plan, "Fixtures") is the one checker both the backend
subtask serving a new or changed response and the front's `fetch` fakes rely on to stay
in step with `web/src/api/fixtures/`. These tests exercise it directly, over the real
fixtures this subtask adds, proving it both accepts a conforming answer and rejects the
ways one can drift from its fixture (CODING_STANDARDS.md section 5: a checker is proven
on bad input, not only on the good one it is meant to pass)."""

import json
from pathlib import Path

import pytest

from tests.contract_shapes import FIXTURES_DIR, assert_matches_fixture


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


def test_null_matches_whatever_type_the_fixture_shows_for_an_optional_field() -> None:
    settled = _load("customer") | {"balance": 0, "owing_since": None, "standing": "settled"}

    assert_matches_fixture(settled, "customer")


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


def test_an_empty_fixture_list_only_checks_that_the_answer_is_a_list() -> None:
    answer = _load("debtors") | {"debtors": []}

    # The real fixture's own `debtors` list is not empty, so this proves the emptied
    # answer still matches: an empty list carries no item shape to check against.
    assert_matches_fixture(answer, "debtors")
