"""`name_matches` is the only gate before a real run touches anything: it strips
only the typed line's trailing newline and compares NFC forms (the plan's
invariant)."""

from __future__ import annotations

import unicodedata

from app.business_removal.domain.confirmation import name_matches


def test_an_exact_line_matches() -> None:
    assert name_matches("La Huerta\n", "La Huerta") is True


def test_a_line_with_no_trailing_newline_still_matches() -> None:
    assert name_matches("La Huerta", "La Huerta") is True


def test_a_different_name_does_not_match() -> None:
    assert name_matches("La Otra Huerta\n", "La Huerta") is False


def test_an_nfd_typed_name_matches_an_nfc_stored_name() -> None:
    stored = "Café"
    typed_nfd = unicodedata.normalize("NFD", stored) + "\n"

    assert name_matches(typed_nfd, stored) is True


def test_a_stray_leading_space_does_not_match() -> None:
    # Only the trailing newline is stripped; nothing else is folded.
    assert name_matches(" La Huerta\n", "La Huerta") is False
