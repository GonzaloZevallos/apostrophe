"""The front-path templates and the two tables built on them (docs/adr/0024, amendment of
GH-59): the matcher on its own, the tables against the files that name the same screens,
and the API's OpenAPI document against the snapshot committed before the English routes."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from pathlib import Path

import pytest

from app.main import create_app
from app.static_spa import (
    LEGACY_FRONT_PATHS,
    SHARED_FRONT_PATHS,
    MalformedLegacyFrontPaths,
    matches_template,
    parse_legacy_front_paths,
)
from tests.conftest import SETTINGS, TEST_HASHER
from tests.fakes.telegram import FakeTelegram

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / "fixtures"
SCREENS_JSON = ROOT / "scripts" / "design" / "screens.json"

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


def normalise(path: str) -> str:
    """The one normaliser: every `{name}` segment of a path, a template's or the design
    registry's (`/sales/{owing_sale}`), becomes `{id}`."""
    return re.sub(r"\{[a-z_]+\}", "{id}", path)


def _screen_paths() -> set[str]:
    document = json.loads(SCREENS_JSON.read_text())
    entries = [*document["screens"], *document["registry"]]
    return {normalise(entry["path"]) for entry in entries if entry.get("path")}


def without_screen(paths: Iterable[str], screens: set[str]) -> list[str]:
    """The paths, normalised, that no screen of the design registry has: what the checks
    below refuse. There is no exemption list."""
    return sorted({normalise(path) for path in paths} - screens)


def uncovered(old_paths: Iterable[str], rows: Iterable[tuple[str, str]]) -> list[str]:
    """The old paths (an `{id}` read as 7) that no legacy row's `old` template matches."""
    templates = [old for old, _ in rows]
    return sorted(
        path
        for path in old_paths
        if not any(
            matches_template(path.replace("{id}", "7"), old) is not None for old in templates
        )
    )


def test_the_normaliser_reads_every_placeholder_name_as_an_id() -> None:
    assert normalise("/sales/{owing_sale}") == "/sales/{id}"
    assert normalise("/customers/{debtor}/edit") == "/customers/{id}/edit"
    assert normalise("/varieties/{low}/prices/new") == "/varieties/{id}/prices/new"
    assert normalise("/sales/{id}") == "/sales/{id}"
    assert normalise("/sales/new") == "/sales/new"


def test_every_old_router_path_has_a_legacy_row() -> None:
    fixture = json.loads((FIXTURES / "legacy_front_paths.json").read_text())

    assert not uncovered(fixture["paths"], LEGACY_FRONT_PATHS)
    assert fixture["removed"] == []


def test_a_fixture_path_with_no_legacy_row_is_refused() -> None:
    rows = [("/ventas", "/sales"), ("/ventas/{id}", "/sales/{id}")]

    assert uncovered(["/ventas", "/ventas/{id}", "/clientes/{id}"], rows) == ["/clientes/{id}"]
    assert uncovered(["/ventas/nueva"], rows) == ["/ventas/nueva"]


def test_every_legacy_target_is_a_screen_of_the_design() -> None:
    targets = [new for _, new in LEGACY_FRONT_PATHS]

    assert not without_screen(targets, _screen_paths())


def test_every_shared_template_is_a_screen_of_the_design() -> None:
    assert not without_screen(SHARED_FRONT_PATHS, _screen_paths())


def test_a_path_with_no_screen_in_the_design_is_refused() -> None:
    screens = _screen_paths()

    assert without_screen(["/sales", "/sales/{owing_sale}"], screens) == []
    assert without_screen(["/sales/{debtor}/refund", "/nowhere"], screens) == [
        "/nowhere",
        "/sales/{id}/refund",
    ]


def test_the_registry_entries_of_screens_json_say_a_kind_and_a_parent_that_are_paths() -> None:
    document = json.loads(SCREENS_JSON.read_text())
    paths = _screen_paths()

    for entry in document["registry"]:
        assert entry["kind"] in {"root", "card", "form"}, entry
        assert (entry["kind"] == "root") == (entry.get("parent") is None), entry
        if entry.get("parent") is not None:
            assert normalise(entry["parent"]) in paths, entry
        if entry.get("computer_parent") is not None:
            assert normalise(entry["computer_parent"]) in paths, entry
        if entry.get("archived_parent") is not None:
            assert normalise(entry["archived_parent"]) in paths, entry
            assert entry["archived_parent"] != entry["parent"], entry
    registered = {normalise(entry["path"]) for entry in document["registry"]}
    assert {"/customers/new", "/customers/{id}/edit", "/varieties/entries/{id}"} <= registered
    with_archived_parent = {
        entry["path"] for entry in document["registry"] if "archived_parent" in entry
    }
    assert with_archived_parent == {"/varieties/{id}"}


def _sample(template: str) -> str:
    return template.replace("{id}", "7")


@pytest.mark.parametrize("template", sorted(SHARED_FRONT_PATHS))
def test_a_templates_sample_matches_that_template_and_no_other(template: str) -> None:
    sample = _sample(template)
    matching = [path for path in SHARED_FRONT_PATHS if matches_template(sample, path) is not None]

    assert matching == [template]


@pytest.mark.parametrize(
    "template", sorted(path for path in SHARED_FRONT_PATHS if "{id}" in path)
)
def test_no_literal_shared_path_is_claimed_by_an_id_template(template: str) -> None:
    literals = [path for path in SHARED_FRONT_PATHS if "{id}" not in path]

    claimed = [path for path in literals if matches_template(path, template) is not None]

    assert claimed == []


def _rows_text(rows: object) -> str:
    return json.dumps(rows)


def test_the_shipped_legacy_rows_load_and_carry_the_id_across() -> None:
    assert dict(LEGACY_FRONT_PATHS)["/variedades/{id}"] == "/varieties/{id}"
    assert dict(LEGACY_FRONT_PATHS)["/mi-stock/entradas/{id}"] == "/varieties/entries/{id}"
    assert parse_legacy_front_paths((ROOT / "app" / "legacy_front_paths.json").read_text()) == (
        LEGACY_FRONT_PATHS
    )


def test_a_well_formed_rows_file_is_read_in_order() -> None:
    rows = [{"old": "/a-b/{id}", "now": "/c/{id}"}, {"old": "/d", "now": "/e"}]

    assert parse_legacy_front_paths(_rows_text(rows)) == (("/a-b/{id}", "/c/{id}"), ("/d", "/e"))


@pytest.mark.parametrize(
    "text",
    [
        "not json",
        "{}",
        _rows_text([{"old": "/a"}]),
        _rows_text([{"old": "/a", "now": "/b", "extra": "/c"}]),
        _rows_text([{"old": 7, "now": "/b"}]),
        _rows_text([{"old": "a", "now": "/b"}]),
        _rows_text([{"old": "/a//b", "now": "/b"}]),
        _rows_text([{"old": "/a/", "now": "/b"}]),
        _rows_text([{"old": "/a/{name}", "now": "/b/{name}"}]),
        _rows_text([{"old": "/a/[0-9]+", "now": "/b"}]),
        _rows_text([{"old": "/A", "now": "/b"}]),
        _rows_text([{"old": "/a", "now": "/b/{id}"}]),
        _rows_text([{"old": "/a", "now": "/b"}, {"old": "/a", "now": "/c"}]),
    ],
)
def test_a_malformed_rows_file_is_refused(text: str) -> None:
    with pytest.raises(MalformedLegacyFrontPaths):
        parse_legacy_front_paths(text)


def test_the_api_document_is_the_one_committed_before_the_english_routes() -> None:
    snapshot = json.loads((FIXTURES / "openapi_snapshot.json").read_text())
    document = create_app(
        SETTINGS, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    ).openapi()

    assert json.loads(json.dumps(document)) == snapshot
