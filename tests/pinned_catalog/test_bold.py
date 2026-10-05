"""`telegram_bold` and `fits_in_one_message` (the plan's declared seam): the pairing
cases shared with the front's `telegramPreview.test.ts` via
`telegramPreview.cases.json`, so the plain text Telegram renders and the in-app preview
can never drift apart (ADR-0022; ADR-0023)."""

import json
from pathlib import Path

import pytest

from app.pinned_catalog.domain.bold import fits_in_one_message, telegram_bold, utf16_length

CASES_PATH = (
    Path(__file__).resolve().parent.parent.parent / "web" / "src" / "screens"
    / "telegramPreview.cases.json"
)
CASES = json.loads(CASES_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[repr(c["input"]) for c in CASES])
def test_pairs_markers_left_to_right_matching_the_front_s_preview(
    case: dict[str, object],
) -> None:
    raw_input = case["input"]
    assert isinstance(raw_input, str)

    plain, spans = telegram_bold(raw_input)

    assert plain == case["plain"]
    assert [list(span) for span in spans] == case["spans"]


def test_an_emoji_name_s_span_is_measured_in_utf16_code_units_not_python_characters() -> None:
    # "👍🏽" is two codepoints outside the BMP: 4 UTF-16 units, not 2 `len()` characters.
    plain, spans = telegram_bold("👍🏽 **Oferta**")

    assert utf16_length("👍🏽") == 4
    assert spans == [(5, 6)]
    start, length = spans[0]
    utf16 = plain.encode("utf-16-le")
    assert utf16[start * 2 : (start + length) * 2].decode("utf-16-le") == "Oferta"


def test_text_at_exactly_4096_utf16_units_fits() -> None:
    text = "a" * 4096

    assert fits_in_one_message(text) is True


def test_text_at_4097_utf16_units_does_not_fit() -> None:
    text = "a" * 4097

    assert fits_in_one_message(text) is False


def test_an_emoji_heavy_text_is_measured_in_utf16_units_at_the_boundary() -> None:
    # Each "👍🏽" costs 4 UTF-16 units; 1024 of them sit exactly at the 4096 limit.
    at_limit = "👍🏽" * 1024
    over_limit = at_limit + "a"

    assert fits_in_one_message(at_limit) is True
    assert fits_in_one_message(over_limit) is False
