"""`terminal_name`, `slug`, `file_name` and `is_inside` (the plan's seams): the only
place a business name is made safe to print, slugged or checked against a path."""

import unicodedata
from datetime import UTC, datetime
from pathlib import Path

from app.business_removal.domain.naming import file_name, is_inside, slug, terminal_name


def test_terminal_name_escapes_a_control_character_but_leaves_plain_text() -> None:
    assert terminal_name("La Flor") == "La Flor"
    assert terminal_name("esc\x1b[1mbold") == "esc\\u001b[1mbold"
    assert terminal_name("line\rfeed") == "line\\u000dfeed"


def test_terminal_name_normalises_nfd_and_nfc_to_the_same_escaped_text() -> None:
    composed = "Café"
    decomposed = unicodedata.normalize("NFD", composed)
    assert composed != decomposed  # the two forms really are different strings

    assert terminal_name(composed) == terminal_name(decomposed) == "Café"


def test_slug_keeps_only_lowercased_ascii_letters_and_digits() -> None:
    assert slug("Café Rico 2") == "caf-rico-2"


def test_slug_falls_back_to_business_when_nothing_qualifies() -> None:
    assert slug("🌿🌿🌿") == "business"


def test_file_name_carries_the_slug_and_the_instant_in_utc() -> None:
    at = datetime(2026, 10, 3, 14, 5, 9, tzinfo=UTC)

    assert file_name("Café Rico", at) == "caf-rico-20261003-140509.json"


def test_file_name_converts_a_non_utc_instant() -> None:
    from datetime import timedelta, timezone

    at = datetime(2026, 10, 3, 11, 5, 9, tzinfo=timezone(timedelta(hours=-3)))

    assert file_name("Business", at) == "business-20261003-140509.json"


def test_is_inside_matches_the_root_itself_and_anything_under_it() -> None:
    root = Path("/a/b")

    assert is_inside(root, root)
    assert is_inside(Path("/a/b/c"), root)
    assert not is_inside(Path("/a/c"), root)
