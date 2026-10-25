"""The removal command's English words, as the tests read them: the real adapter over
production `en`, and the baseline text of a line with no data (`en.baseline.json`)."""

from __future__ import annotations

import json
from pathlib import Path

from app.business_removal.adapters.operator_words import TranslatedOperatorWords
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import operator_translator
from app.shared.language import ENGLISH

BASELINE = Path(__file__).resolve().parents[2] / "app" / "shared" / "copy" / "en.baseline.json"


def english_words() -> TranslatedOperatorWords:
    return TranslatedOperatorWords(
        operator_translator(
            locales_dir=DEFAULT_LOCALES_DIR, operator_language=ENGLISH, forced_language=None
        )
    )


def baseline_text(key: str) -> str:
    entries: dict[str, dict[str, str]] = json.loads(BASELINE.read_text(encoding="utf-8"))
    return entries[key]["text"]
