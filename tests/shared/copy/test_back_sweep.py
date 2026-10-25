"""The back sweep, catalog part (docs/adr/0050): under the test locale every letter of
`catalog_text` and `pinned_catalog_text` sits inside a `⟦…⟧` segment, stored data or a money
or grams rendering. Stripped by exact strings the test computed, never by pattern."""

import re

import pytest

from app.catalog.adapters.babel_words import BabelCatalogWords
from app.catalog.domain.text import CatalogEntry, catalog_text, pinned_catalog_text
from app.catalog.domain.words import CatalogWords
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog
from app.shared.language import TEST_LOCALE
from tests.catalog.reference_texts import entry

NAME, EMOJI, AROMA, HEADER, FOOTER = "Zorblax", "\U0001f33f", "Quimbly", "Hdrwq", "Ftrwq"
SENTINELS = (NAME, AROMA, HEADER, FOOTER, "$11.000", "$9.000", "2,5 g", "60", "40", "**", EMOJI)
SEGMENT = re.compile("⟦[^⟧]*⟧")


def entries() -> list[CatalogEntry]:
    return [
        entry(
            NAME,
            emoji=EMOJI,
            indica_share=60,
            aroma=AROMA,
            list_price=11000,
            bulk_price=9000,
            bulk_minimum="2.5",
        )
    ]


def leftover_letters(text: str) -> str:
    """What is left of `text` once the segments and the sentinels are removed, letters only."""
    rest = SEGMENT.sub("", text)
    for sentinel in SENTINELS:
        rest = rest.replace(sentinel, "")
    return "".join(character for character in rest if character.isalpha())


def pseudo_words() -> CatalogWords:
    return BabelCatalogWords(CopyCatalog(DEFAULT_LOCALES_DIR)).words_for(TEST_LOCALE)


def test_the_catalog_text_leaves_no_letter_outside_the_segments() -> None:
    text = catalog_text(pseudo_words(), HEADER, FOOTER, entries())

    assert text is not None
    assert "⟦" in text
    assert leftover_letters(text) == ""


def test_the_pinned_catalog_text_with_and_without_entries_leaves_no_letter() -> None:
    assert leftover_letters(pinned_catalog_text(pseudo_words(), HEADER, FOOTER, entries())) == ""
    assert leftover_letters(pinned_catalog_text(pseudo_words(), HEADER, FOOTER, [])) == ""


def test_a_bulk_line_that_appends_a_literal_fails_the_sweep() -> None:
    real = pseudo_words()
    planted = CatalogWords(
        nothing_to_offer=real.nothing_to_offer,
        indica=real.indica,
        aroma=real.aroma,
        price_per_gram=real.price_per_gram,
        bulk=lambda grams, price: real.bulk(grams, price) + " each",
    )

    text = catalog_text(planted, HEADER, FOOTER, entries())

    assert text is not None
    assert leftover_letters(text) == "each"


def test_an_english_nothing_to_offer_line_fails_the_sweep() -> None:
    real = pseudo_words()
    planted = CatalogWords(
        nothing_to_offer="Nothing to offer for now.",
        indica=real.indica,
        aroma=real.aroma,
        price_per_gram=real.price_per_gram,
        bulk=real.bulk,
    )

    assert leftover_letters(pinned_catalog_text(planted, HEADER, FOOTER, [])) == (
        "Nothingtoofferfornow"
    )


@pytest.mark.parametrize("word", ["indica", "sativa"])
def test_the_pseudo_lines_hold_none_of_the_english_words(word: str) -> None:
    text = catalog_text(pseudo_words(), HEADER, FOOTER, entries())

    assert text is not None
    assert word not in text
