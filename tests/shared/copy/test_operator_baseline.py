"""The baseline of today's operator lines (`app/shared/copy/en.baseline.json`): the shape
every entry keeps, whichever part of the move it is in."""

import json
import re
from pathlib import Path
from string import Formatter

import pytest

from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import MissingOperatorKey, OperatorText, operator_translator, po_messages
from app.shared.copy.messages import po_path
from app.shared.language import ENGLISH

BASELINE = Path(__file__).resolve().parents[3] / "app" / "shared" / "copy" / "en.baseline.json"
AREAS = ("accounts", "import", "removal")


def baseline() -> dict[str, dict[str, object]]:
    loaded: dict[str, dict[str, object]] = json.loads(BASELINE.read_text(encoding="utf-8"))
    return loaded


def test_every_baseline_key_names_its_area_and_a_line() -> None:
    for key, entry in baseline().items():
        assert re.fullmatch(r"operator\.(accounts|import|removal)\.[a-z_]+", key), key
        assert key.split(".")[1] == entry["area"]
        assert entry["area"] in AREAS


def test_every_baseline_text_uses_only_named_placeholders_and_no_percent() -> None:
    for key, entry in baseline().items():
        text = str(entry["text"])
        assert "%" not in text, key
        for _literal, field, _spec, _conv in Formatter().parse(text):
            assert field is None or re.fullmatch(r"[a-z_]+", field), key


def test_the_baseline_holds_every_area() -> None:
    assert {str(entry["area"]) for entry in baseline().values()} == set(AREAS)


def sample_data(text: str) -> dict[str, str]:
    return {
        str(field): f"<{field}>"
        for _literal, field, _spec, _conv in Formatter().parse(text)
        if field is not None
    }


def production_en() -> OperatorText:
    return operator_translator(
        locales_dir=DEFAULT_LOCALES_DIR, operator_language=ENGLISH, forced_language=None
    )


def settled() -> dict[str, dict[str, object]]:
    return {key: entry for key, entry in baseline().items() if not entry.get("pending")}


def test_every_settled_key_renders_in_production_english_as_its_baseline_text_byte_for_byte() -> (
    None
):
    text = production_en()
    assert settled()
    for key, entry in settled().items():
        data = sample_data(str(entry["text"]))
        assert text(key, **data) == str(entry["text"]).format(**data), key


def test_a_key_still_pending_does_not_resolve_in_production_english() -> None:
    text = production_en()
    resolving = [
        key
        for key, entry in baseline().items()
        if entry.get("pending") and resolves_while_pending(text, key, entry)
    ]
    assert resolving == []


def test_every_operator_text_the_catalog_holds_is_in_the_baseline_with_named_placeholders() -> None:
    held = {
        str(key): str(value)
        for key, value in po_messages(po_path(DEFAULT_LOCALES_DIR, "en")).items()
        if str(key).startswith("operator.")
    }
    assert held
    for key, value in held.items():
        assert key in baseline(), key
        assert "%" not in value, key
        for _literal, field, _spec, _conv in Formatter().parse(value):
            assert field != "", key


def test_the_check_on_pending_keys_rejects_one_that_already_resolves() -> None:
    entry = {"area": "accounts", "text": "no user for that email", "pending": True}

    assert resolves_while_pending(production_en(), "operator.accounts.no_user", entry)
    assert not resolves_while_pending(production_en(), "operator.removal.failed", entry)


def resolves_while_pending(text: OperatorText, key: str, entry: dict[str, object]) -> bool:
    try:
        text(key, **sample_data(str(entry["text"])))
    except MissingOperatorKey:
        return False
    return bool(entry.get("pending"))
