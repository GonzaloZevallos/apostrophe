"""`name_of` and `recorder_initials` (docs/product/initials.md, "Marca de quien registró")."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.accounts.domain.account import Email
from app.accounts.domain.recorder import (
    FALLBACK_INITIALS,
    initials_of,
    name_of,
    recorder_initials,
)
from app.shared.recorder import MAX_INITIALS, Recorder

CASES_PATH = Path(__file__).resolve().parents[2] / "web/src/format/initials.cases.json"

ACUTE = "́"

# Every row is a local part; `Email(f"{local}@x.co")` is built directly, never `Email.of`.
# Whitespace is refused by `Email` (`str.isspace`), so the two-word row separates with U+FEFF,
# which is in JS `\s` (a word break for `initials_of`) but not in `str.isspace`.
AWKWARD_LOCALS = [
    pytest.param(".", id="dot"),
    pytest.param(ACUTE, id="lone-combining-mark"),
    pytest.param("😀" * 60, id="emoji-60"),
    pytest.param("a" + ACUTE * 40, id="a-plus-40-marks"),
    pytest.param(("a" + ACUTE * 40) + "﻿" + ("b" + ACUTE * 40), id="two-words-of-40-marks"),
    pytest.param("ß" + ACUTE * 40, id="sharp-s-plus-40-marks"),
    pytest.param("ŉ" + ACUTE * 40, id="n-apostrophe-plus-40-marks"),
    pytest.param("ǰ" + ACUTE * 40, id="j-caron-plus-40-marks"),
    pytest.param("ﬃ" + ACUTE * 40, id="ffi-ligature-plus-40-marks"),
    pytest.param("​", id="zero-width-space"),
    pytest.param("﻿a", id="feff-then-a"),
]


def _email(local: str) -> Email:
    return Email(f"{local}@x.co")


@pytest.mark.parametrize("local", AWKWARD_LOCALS)
def test_every_awkward_fixture_is_an_email_that_email_accepts(local: str) -> None:
    assert name_of(_email(local)) == local


def test_name_of_gives_the_local_part() -> None:
    assert name_of(Email("zeta@x.co")) == "zeta"
    assert name_of(Email("a.b+c@sub.x.co")) == "a.b+c"


@pytest.mark.parametrize("local", ["﻿", "﻿﻿"])
def test_a_local_part_of_only_feff_gives_the_fallback(local: str) -> None:
    assert FALLBACK_INITIALS == "?"
    assert recorder_initials(_email(local)) == "?"


def test_a_local_part_of_a_zero_width_space_keeps_its_invisible_initials() -> None:
    assert recorder_initials(_email("​")) == "​"


@pytest.mark.parametrize("local", AWKWARD_LOCALS)
def test_awkward_emails_give_a_valid_mark(local: str) -> None:
    result = recorder_initials(_email(local))
    assert result
    assert len(result) <= MAX_INITIALS
    assert result in (FALLBACK_INITIALS, initials_of(local))
    assert Recorder(1, result).initials == result


def _fixture_names() -> list[str]:
    raw: object = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    assert isinstance(raw, list)
    names: list[str] = []
    for item in raw:
        assert isinstance(item, dict)
        name = item["name"]
        assert isinstance(name, str)
        names.append(name)
    return sorted(names, key=len, reverse=True)[:5]


@pytest.mark.parametrize("name", _fixture_names(), ids=lambda name: repr(name)[:30])
def test_the_longest_fixture_rows_stay_within_the_limit_as_names(name: str) -> None:
    result = initials_of(name)
    assert result
    assert len(result) <= MAX_INITIALS
    assert Recorder(1, result).initials == result


@pytest.mark.parametrize("name", _fixture_names(), ids=lambda name: repr(name)[:30])
def test_the_longest_fixture_rows_stay_within_the_limit_as_local_parts(name: str) -> None:
    local = "".join(char for char in name if not char.isspace() and char != "﻿")
    result = recorder_initials(_email(local))
    assert result
    assert len(result) <= MAX_INITIALS
    assert result in (FALLBACK_INITIALS, initials_of(local))
