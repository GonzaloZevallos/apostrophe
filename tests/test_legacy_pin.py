"""The parser of the hand-written legacy fixture (docs/adr/0033, amendment of GH-134): what it
accepts and, one malformed shape at a time, what it refuses."""

from __future__ import annotations

import json

import pytest

from tests.legacy_pin import MalformedPinnedRows, parse_pinned_rows


def _text(rows: object = None, removed: object = None) -> str:
    document: dict[str, object] = {
        "_": "note",
        "rows": [{"old": "/a", "now": "/b"}] if rows is None else rows,
        "removed": [] if removed is None else removed,
    }
    return json.dumps(document)


def test_a_valid_fixture_is_read_in_file_order_with_the_id_kept_literal() -> None:
    text = _text(
        rows=[{"old": "/z/{id}", "now": "/y/{id}"}, {"old": "/a", "now": "/b"}],
    )

    assert parse_pinned_rows(text) == (("/z/{id}", "/y/{id}"), ("/a", "/b"))


@pytest.mark.parametrize(
    "text",
    [
        pytest.param("not json", id="not json"),
        pytest.param(json.dumps([]), id="top level is a list"),
        pytest.param(json.dumps({"_": "n", "rows": [], "removed": [], "x": 1}), id="extra top key"),
        pytest.param(json.dumps({"_": "n", "rows": []}), id="missing top key"),
        pytest.param(json.dumps({"_": "n", "paths": [], "removed": []}), id="renamed rows key"),
        pytest.param(_text(rows={"old": "/a", "now": "/b"}), id="rows is not a list"),
        pytest.param(_text(rows=["/a"]), id="a row is not an object"),
        pytest.param(_text(rows=[{"now": "/b"}]), id="a row misses old"),
        pytest.param(_text(rows=[{"old": "/a"}]), id="a row misses now"),
        pytest.param(
            _text(rows=[{"old": "/a", "now": "/b", "extra": "/c"}]), id="a row has an extra key"
        ),
        pytest.param(_text(rows=[{"old": 7, "now": "/b"}]), id="old is not a string"),
        pytest.param(_text(rows=[{"old": "/a", "now": None}]), id="now is not a string"),
        pytest.param(
            _text(rows=[{"old": "/a", "now": "/b"}, {"old": "/a", "now": "/c"}]),
            id="old appears twice",
        ),
        pytest.param(
            _text(rows=[{"old": "/a", "now": "/b"}, {"old": "/a", "now": "/b"}]),
            id="an identical row appears twice",
        ),
        pytest.param(_text(removed=["/gone"]), id="removed is not empty"),
        pytest.param(_text(removed={}), id="removed is not a list"),
    ],
)
def test_a_malformed_fixture_is_refused(text: str) -> None:
    with pytest.raises(MalformedPinnedRows):
        parse_pinned_rows(text)
