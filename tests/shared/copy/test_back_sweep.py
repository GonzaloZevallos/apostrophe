"""The back sweep, catalog part (docs/adr/0050): under the test locale every letter of
`catalog_text` and `pinned_catalog_text` sits inside a `⟦…⟧` segment, stored data or a money
or grams rendering. Stripped by exact strings the test computed, never by pattern."""

import pytest

from app.catalog.adapters.babel_defaults import BabelHeaderFooterDefaults
from app.catalog.adapters.babel_words import BabelCatalogWords
from app.catalog.domain.text import CatalogEntry, catalog_text, pinned_catalog_text
from app.catalog.domain.words import CatalogWords
from app.expenses.adapters.babel_defaults import BabelCategoryDefaults
from app.expenses.domain.category import CategoryName
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog
from app.shared.language import TEST_LOCALE
from tests.catalog.reference_texts import entry

NAME, EMOJI, AROMA, HEADER, FOOTER = "Zorblax", "\U0001f33f", "Quimbly", "Hdrwq", "Ftrwq"
SENTINELS = (NAME, AROMA, HEADER, FOOTER, "$11.000", "$9.000", "2,5 g", "60", "40", "**", EMOJI)

_PSEUDO = CopyCatalog(DEFAULT_LOCALES_DIR).translations(TEST_LOCALE).gettext


def exact_segments() -> tuple[str, ...]:
    """The `⟦…⟧` segments the catalog lines come to under the sentinel holes, computed here
    from the shipped `en-XA` messages with the formatted values the domain passes, never from
    the `CatalogWords` under test, so a planted literal beside a real segment is not removed."""
    return (
        _PSEUDO("catalog.nothing_to_offer"),
        _PSEUDO("catalog.indica_line").format(indica="60", sativa="40"),
        _PSEUDO("catalog.aroma_line").format(aroma=AROMA),
        _PSEUDO("catalog.price_per_gram_line").format(price="$11.000"),
        _PSEUDO("catalog.bulk_line").format(quantity="2,5 g", price="$9.000"),
    )


DEFAULT_KEYS = (
    "catalog.default_header",
    "catalog.default_footer",
    "expenses.default_category.growing_supplies",
    "expenses.default_category.packaging",
    "expenses.default_category.shipping_and_transport",
    "expenses.default_category.other",
)


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
    rest = text
    for segment in exact_segments():
        rest = rest.replace(segment, "")
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
        bulk=lambda quantity, price: real.bulk(quantity, price) + " each",
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


def default_texts(categories: tuple[CategoryName, ...] | None = None) -> list[str]:
    """What a business opened under the test locale would store: the defaults the real
    sources build, called directly, nothing stored."""
    copy = CopyCatalog(DEFAULT_LOCALES_DIR)
    header_footer = BabelHeaderFooterDefaults(copy).for_language(TEST_LOCALE)
    names = categories or BabelCategoryDefaults(copy).for_language(TEST_LOCALE)
    return [header_footer.header, header_footer.footer, *(name.value for name in names)]


DEFAULT_SENTINELS = ("\U0001f33f", "\U0001f4e9", "**")


def default_letters(texts: list[str]) -> str:
    """Letters left once the segments and the emoji and `**` are removed, by exact string."""
    left = ""
    for default in texts:
        rest = default
        for key in DEFAULT_KEYS:
            rest = rest.replace(_PSEUDO(key), "")
        for sentinel in DEFAULT_SENTINELS:
            rest = rest.replace(sentinel, "")
        left += "".join(character for character in rest if character.isalpha())
    return left


def test_the_defaults_under_the_test_locale_leave_no_letter_outside_the_segments() -> None:
    texts = default_texts()

    assert len(texts) == 6
    assert all("⟦" in text for text in texts)
    assert default_letters(texts) == ""


def test_a_categories_source_with_a_real_name_and_a_literal_fails_the_sweep() -> None:
    real = BabelCategoryDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(TEST_LOCALE)
    planted = (real[0], CategoryName.of("Other"))

    assert default_letters(default_texts(planted)) == "Other"
