"""`BabelCatalogWords` over `CopyCatalog` (adapter class): the same reference set as the
hand-built words, a missing key named by key only, an absent language answered in English."""

import shutil
from pathlib import Path

import pytest

from app.catalog.adapters.babel_words import BabelCatalogWords
from app.catalog.domain.text import catalog_text, pinned_catalog_text
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog, MissingCatalogKey, compile_po
from app.shared.language import ENGLISH, TEST_LOCALE, Language
from tests.catalog.reference_texts import CASES, Case


def production_words() -> BabelCatalogWords:
    return BabelCatalogWords(CopyCatalog(DEFAULT_LOCALES_DIR))


@pytest.mark.parametrize("case", CASES, ids=lambda case: case.name)
def test_production_english_writes_the_reference_literals(case: Case) -> None:
    words = production_words().words_for(ENGLISH)

    assert catalog_text(words, case.header, case.footer, case.entries) == case.expected
    expected = case.expected if case.expected is not None else case.expected_pinned
    assert pinned_catalog_text(words, case.header, case.footer, case.entries) == expected


@pytest.fixture
def locales(tmp_path: Path) -> Path:
    target = tmp_path / "locales"
    for tag in ("en", "en-XA"):
        shutil.copytree(DEFAULT_LOCALES_DIR / tag, target / tag)
    return target


def remove_entry(locales: Path, tag: str, key: str) -> None:
    po = locales / tag / "LC_MESSAGES" / "apostrophe.po"
    blocks = po.read_text(encoding="utf-8").split("\n\n")
    kept = [block for block in blocks if f'msgid "{key}"' not in block]
    assert len(kept) == len(blocks) - 1
    po.write_text("\n\n".join(kept), encoding="utf-8")
    compile_po(po, po.with_suffix(".mo"))


def test_a_catalog_missing_a_key_raises_naming_only_the_key(locales: Path) -> None:
    remove_entry(locales, "en", "catalog.price_per_gram_line")

    with pytest.raises(MissingCatalogKey) as raised:
        BabelCatalogWords(CopyCatalog(locales))

    assert raised.value.key == "catalog.price_per_gram_line"
    assert str(raised.value) == "No catalog text for key catalog.price_per_gram_line"


def test_a_language_without_a_compiled_catalog_answers_the_english_words() -> None:
    words = production_words()

    absent = words.words_for(Language("fr"))

    assert absent.nothing_to_offer == "Nothing to offer for now."
    assert absent.bulk("10 g", "$10.000") == "• From 10 g: $10.000 each"


def test_the_percent_survives_in_english_and_the_test_locale() -> None:
    words = production_words()

    assert words.words_for(ENGLISH).indica("60", "40") == "• 60% indica / 40% sativa"
    assert "60% " in words.words_for(TEST_LOCALE).indica("60", "40")
    assert "40% " in words.words_for(TEST_LOCALE).indica("60", "40")
