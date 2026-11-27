"""The shared initials rule: the back's `initials_of` must give, for every row of the fixture
`web/src/format/initials.cases.json`, the same initials the front's `initialsOf` gives
(docs/product/initials.md)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.accounts.domain import recorder
from app.accounts.domain.recorder import initials_of

CASES_PATH = Path(__file__).resolve().parents[2] / "web/src/format/initials.cases.json"


def _load_cases() -> tuple[tuple[str, str], ...]:
    raw: object = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    assert isinstance(raw, list)
    rows: list[tuple[str, str]] = []
    for item in raw:
        assert isinstance(item, dict)
        name = item["name"]
        initials = item["initials"]
        assert isinstance(name, str)
        assert isinstance(initials, str)
        rows.append((name, initials))
    return tuple(rows)


CASES = _load_cases()


@pytest.mark.parametrize(("name", "initials"), CASES, ids=[repr(name)[:40] for name, _ in CASES])
def test_initials_of_matches_the_fixture_row(name: str, initials: str) -> None:
    name.encode("utf-8")
    assert len(initials) <= 32
    assert initials_of(name) == initials


def test_the_whitespace_set_is_js_s_and_nothing_else() -> None:
    whitespace = recorder._WHITESPACE
    assert len(whitespace) == 25
    assert "\ufeff" in whitespace
    assert "\u0085" not in whitespace
    assert not {chr(code) for code in range(0x1C, 0x20)} & whitespace


def test_a_separator_outside_js_s_does_not_split_words() -> None:
    assert initials_of("a\x1cb") == "A\x1c"
