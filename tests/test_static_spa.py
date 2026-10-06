"""The front-path templates and the two tables built on them (docs/adr/0024, amendment of
GH-59): the matcher on its own, the tables against the files that name the same screens,
and the API's OpenAPI document against the snapshot committed before the English routes."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.main import create_app
from app.static_spa import LEGACY_FRONT_PATHS, SHARED_FRONT_PATHS, matches_template
from tests.conftest import SETTINGS, TEST_HASHER
from tests.fakes.telegram import FakeTelegram

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures"
SCREENS_JSON = ROOT / "scripts" / "design" / "screens.json"

# Screens of the structure that have no design file of their own, so `screens.json` has no
# entry for their route (a form reached from a card, a stock entry's edit form). Pinned
# exactly: a route that gains a design entry leaves this set, a new one must be added here.
NO_SCREEN_ENTRY = frozenset(
    {"/customers/new", "/customers/{id}/edit", "/varieties/entries/{id}"}
)


@pytest.mark.parametrize(
    ("path", "template", "expected"),
    [
        ("/sales", "/sales", {}),
        ("/sales/7", "/sales/{id}", {"id": "7"}),
        ("/sales/0042", "/sales/{id}", {"id": "0042"}),
        ("/customers/7/edit", "/customers/{id}/edit", {"id": "7"}),
        ("/varieties/entries/123456789", "/varieties/entries/{id}", {"id": "123456789"}),
        ("/sales/new", "/sales/new", {}),
    ],
)
def test_a_path_that_fits_the_template_whole_matches(
    path: str, template: str, expected: dict[str, str]
) -> None:
    assert matches_template(path, template) == expected


@pytest.mark.parametrize(
    "segment", ["new", "catalog", "entries", "edit", "payment", "abc", "7a", "-7", "7.5", "٧", ""]
)
def test_the_placeholder_matches_digits_only(segment: str) -> None:
    assert matches_template(f"/sales/{segment}", "/sales/{id}") is None


@pytest.mark.parametrize(
    ("path", "template"),
    [
        ("/sales/7/extra", "/sales/{id}"),
        ("/sales", "/sales/{id}"),
        ("/sales/7", "/sales"),
        ("/sales/7/", "/sales/{id}"),
        ("/sales//7", "/sales/{id}"),
        ("/customers/7", "/customers/{id}/edit"),
        ("/customers/7/edit/extra", "/customers/{id}/edit"),
        ("/salesx", "/sales"),
        ("/sales/new/7", "/sales/new"),
        ("/", "/sales"),
    ],
)
def test_an_extra_or_missing_segment_does_not_match(path: str, template: str) -> None:
    assert matches_template(path, template) is None


def test_a_template_with_no_placeholder_captures_nothing_but_still_matches() -> None:
    result = matches_template("/analysis", "/analysis")

    assert result is not None
    assert result == {}


def _normal(path: str) -> str:
    return re.sub(r"\{[a-z_]+\}", "{id}", path)


def _screen_paths() -> set[str]:
    document = json.loads(SCREENS_JSON.read_text())
    return {_normal(entry["path"]) for entry in document["screens"] if entry.get("path")}


def test_every_old_router_path_is_a_legacy_row_or_on_the_removal_list() -> None:
    fixture = json.loads((FIXTURES / "legacy_front_paths.json").read_text())
    rows = {old for old, _ in LEGACY_FRONT_PATHS}

    unaccounted = set(fixture["paths"]) - rows - set(fixture["removed"])

    assert not unaccounted
    assert fixture["removed"] == []


def test_the_legacy_table_has_the_twenty_rows_and_no_row_twice() -> None:
    olds = [old for old, _ in LEGACY_FRONT_PATHS]

    assert len(olds) == 20
    assert len(set(olds)) == 20


def test_every_legacy_target_is_a_screen_of_the_design() -> None:
    targets = {new for _, new in LEGACY_FRONT_PATHS}

    missing = targets - _screen_paths() - NO_SCREEN_ENTRY

    assert not missing, f"legacy targets with no entry in screens.json: {sorted(missing)}"


def test_every_shared_template_is_a_screen_of_the_design() -> None:
    missing = set(SHARED_FRONT_PATHS) - _screen_paths() - NO_SCREEN_ENTRY

    assert not missing, f"shared paths with no entry in screens.json: {sorted(missing)}"


def test_the_exemption_list_holds_only_routes_the_tables_really_name() -> None:
    named = {new for _, new in LEGACY_FRONT_PATHS} | set(SHARED_FRONT_PATHS)

    assert NO_SCREEN_ENTRY <= named
    assert not NO_SCREEN_ENTRY & _screen_paths()


def test_the_api_document_is_the_one_committed_before_the_english_routes() -> None:
    snapshot = json.loads((FIXTURES / "openapi_snapshot.json").read_text())
    document = create_app(
        SETTINGS, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    ).openapi()

    assert json.loads(json.dumps(document)) == snapshot
