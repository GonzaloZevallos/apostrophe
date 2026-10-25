"""The baseline of today's operator lines (`app/shared/copy/en.baseline.json`): the shape
every entry keeps, whichever part of the move it is in."""

import json
import re
from pathlib import Path
from string import Formatter

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
