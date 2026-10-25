"""The defaults a new business is opened with, from the copy module (docs/adr/0050): in every
language the app ships they build a valid header and footer and four valid, distinct
categories, and a catalog missing a default key raises naming only that key."""

import shutil
from pathlib import Path

import pytest

from app.catalog.adapters.babel_defaults import BabelHeaderFooterDefaults
from app.expenses.adapters.babel_defaults import BabelCategoryDefaults
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog, MissingCatalogKey, compile_po
from app.shared.language import ENGLISH, Language

SHIPPED = sorted(CopyCatalog(DEFAULT_LOCALES_DIR).languages(), key=lambda language: language.tag)
FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "locales"


def test_the_shipped_languages_include_english() -> None:
    assert ENGLISH in SHIPPED


@pytest.mark.parametrize("language", SHIPPED, ids=lambda language: language.tag)
def test_every_shipped_language_builds_a_valid_header_and_footer(language: Language) -> None:
    defaults = BabelHeaderFooterDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(language)

    assert defaults.header != "catalog.default_header"
    assert defaults.footer != "catalog.default_footer"
    assert defaults.header
    assert defaults.footer


@pytest.mark.parametrize("language", SHIPPED, ids=lambda language: language.tag)
def test_every_shipped_language_builds_four_distinct_valid_categories(language: Language) -> None:
    names = BabelCategoryDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(language)

    assert len(names) == 4
    assert len({name.key for name in names}) == 4
    assert all(not name.value.startswith("expenses.") for name in names)


def test_english_is_the_baseline_text_in_today_s_order() -> None:
    copy = CopyCatalog(DEFAULT_LOCALES_DIR)

    header_footer = BabelHeaderFooterDefaults(copy).for_language(ENGLISH)
    names = BabelCategoryDefaults(copy).for_language(ENGLISH)

    assert header_footer.header == "\U0001f33f **CATALOG** \U0001f33f"
    assert header_footer.footer == "\U0001f4e9 Questions and orders by private message."
    assert [name.value for name in names] == [
        "Growing supplies",
        "Packaging",
        "Shipping and transport",
        "Other",
    ]


def test_a_language_with_no_compiled_catalog_gets_the_english_defaults() -> None:
    copy = CopyCatalog(DEFAULT_LOCALES_DIR)
    absent = Language("fr")

    assert BabelHeaderFooterDefaults(copy).for_language(absent) == BabelHeaderFooterDefaults(
        copy
    ).for_language(ENGLISH)
    assert BabelCategoryDefaults(copy).for_language(absent) == BabelCategoryDefaults(
        copy
    ).for_language(ENGLISH)


def _without(tmp_path: Path, key: str) -> CopyCatalog:
    target = tmp_path / "locales"
    shutil.copytree(FIXTURES, target)
    po = target / "en" / "LC_MESSAGES" / "apostrophe.po"
    blocks = po.read_text(encoding="utf-8").split("\n\n")
    kept = [block for block in blocks if f'msgid "{key}"' not in block]
    assert len(kept) == len(blocks) - 1
    po.write_text("\n\n".join(kept), encoding="utf-8")
    compile_po(po, po.with_suffix(".mo"))
    return CopyCatalog(target)


@pytest.mark.parametrize("key", ["catalog.default_header", "catalog.default_footer"])
def test_a_catalog_missing_a_header_or_footer_key_raises_naming_only_the_key(
    tmp_path: Path, key: str
) -> None:
    copy = _without(tmp_path, key)

    with pytest.raises(MissingCatalogKey) as raised:
        BabelHeaderFooterDefaults(copy).for_language(ENGLISH)

    assert raised.value.key == key
    assert str(raised.value) == f"No catalog text for key {key}"


def test_a_catalog_missing_a_category_key_raises_naming_only_the_key(tmp_path: Path) -> None:
    key = "expenses.default_category.packaging"
    copy = _without(tmp_path, key)

    with pytest.raises(MissingCatalogKey) as raised:
        BabelCategoryDefaults(copy).for_language(ENGLISH)

    assert raised.value.key == key
