"""`CatalogEmoji.of` (CODING_STANDARDS section 5): the accepted/refused vectors in
`tests/catalog/emoji.vectors.json`, the stdlib-only emoji grammar's declared seam."""

import json
from pathlib import Path
from typing import Any

import pytest

from app.catalog.domain.emoji import CatalogEmoji
from app.catalog.domain.errors import EmojiInvalid

VECTORS: dict[str, Any] = json.loads(
    (Path(__file__).parent / "emoji.vectors.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize(
    "vector", VECTORS["accepted"], ids=[repr(v["input"]) for v in VECTORS["accepted"]]
)
def test_accepted_vectors_are_stored_as_expected(vector: dict[str, str]) -> None:
    assert CatalogEmoji.of(vector["input"]).value == vector["stored"]


@pytest.mark.parametrize("raw", VECTORS["refused"], ids=[repr(v) for v in VECTORS["refused"]])
def test_refused_vectors_are_rejected(raw: str) -> None:
    """The enforcement artefact: every refused vector, two emoji side by side and text
    mixed with an emoji included, is rejected by the grammar, with its own code."""
    with pytest.raises(EmojiInvalid):
        CatalogEmoji.of(raw)
