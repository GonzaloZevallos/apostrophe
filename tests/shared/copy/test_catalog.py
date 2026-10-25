import shutil
from pathlib import Path

import pytest

from app.shared.copy import (
    CopyCatalog,
    UnknownLanguage,
    compile_po,
    missing_keys,
    mo_messages,
    po_messages,
)
from app.shared.language import ENGLISH, TEST_LOCALE, Language

FIXTURE_LOCALES = Path(__file__).resolve().parents[2] / "fixtures" / "locales"
REAL_LOCALES = Path(__file__).resolve().parents[3] / "app" / "shared" / "copy" / "locales"
GERMAN = Language("de")


@pytest.fixture
def locales(tmp_path: Path) -> Path:
    """A writable copy of the fixture locales."""
    target = tmp_path / "locales"
    shutil.copytree(FIXTURE_LOCALES, target)
    return target


def edit_german(locales: Path, old: str, new: str) -> None:
    po = locales / "de" / "LC_MESSAGES" / "apostrophe.po"
    text = po.read_text(encoding="utf-8")
    assert old in text
    po.write_text(text.replace(old, new), encoding="utf-8")
    compile_po(po, po.with_suffix(".mo"))


def test_the_loader_returns_the_translation_of_a_language() -> None:
    translations = CopyCatalog(FIXTURE_LOCALES).translations(GERMAN)

    assert translations.gettext("fixture.greeting") == "Hallo"


def test_the_loader_keeps_percent_braces_newlines_and_plurals() -> None:
    translations = CopyCatalog(FIXTURE_LOCALES).translations(GERMAN)

    assert translations.gettext("fixture.count_percent") == "%(n)s erledigt, zu 100%% sicher"
    assert translations.gettext("fixture.braces") == "Hallo {x}"
    assert translations.gettext("fixture.two_lines") == "Erste Zeile\nZweite Zeile"
    assert translations.ngettext("fixture.items", "fixture.items_plural", 1) == "%(n)s Ding"
    assert translations.ngettext("fixture.items", "fixture.items_plural", 2) == "%(n)s Dinge"


def test_a_key_the_language_lacks_comes_back_in_english(locales: Path) -> None:
    po = locales / "de" / "LC_MESSAGES" / "apostrophe.po"
    text = po.read_text(encoding="utf-8")
    po.write_text(text.replace('msgstr "Auf Wiedersehen"', 'msgstr ""'), encoding="utf-8")
    compile_po(po, po.with_suffix(".mo"))

    translations = CopyCatalog(locales).translations(GERMAN)

    assert translations.gettext("fixture.farewell") == "Goodbye"
    assert translations.gettext("fixture.greeting") == "Hallo"


def test_english_translates_to_itself() -> None:
    assert CopyCatalog(FIXTURE_LOCALES).translations(ENGLISH).gettext("fixture.greeting") == (
        "Hello"
    )


def test_an_unknown_tag_raises() -> None:
    with pytest.raises(UnknownLanguage) as refused:
        CopyCatalog(FIXTURE_LOCALES).translations(Language("fr"))

    assert "fr" in str(refused.value)


def test_the_languages_are_the_directories_with_a_compiled_catalog(locales: Path) -> None:
    (locales / "fr" / "LC_MESSAGES").mkdir(parents=True)
    (locales / "fr" / "LC_MESSAGES" / "apostrophe.po").write_text("", encoding="utf-8")
    (locales / "not a tag" / "LC_MESSAGES").mkdir(parents=True)
    (locales / "not a tag" / "LC_MESSAGES" / "apostrophe.mo").write_bytes(b"")

    assert CopyCatalog(locales).languages() == {ENGLISH, GERMAN, TEST_LOCALE}


def test_a_missing_locales_directory_has_no_languages(tmp_path: Path) -> None:
    assert CopyCatalog(tmp_path / "nowhere").languages() == frozenset()


def test_the_real_catalog_has_english() -> None:
    assert ENGLISH in CopyCatalog(REAL_LOCALES).languages()


def test_a_complete_language_misses_nothing() -> None:
    assert missing_keys(FIXTURE_LOCALES, GERMAN) == ()


def test_an_absent_key_is_missing(locales: Path) -> None:
    po = locales / "de" / "LC_MESSAGES" / "apostrophe.po"
    po.write_text(
        po.read_text(encoding="utf-8").replace(
            'msgid "fixture.farewell"\nmsgstr "Auf Wiedersehen"\n', ""
        ),
        encoding="utf-8",
    )

    assert missing_keys(locales, GERMAN) == ("fixture.farewell",)


def test_a_fuzzy_key_is_missing_even_with_a_translation(locales: Path) -> None:
    edit_german(locales, 'msgid "fixture.greeting"', '#, fuzzy\nmsgid "fixture.greeting"')

    assert missing_keys(locales, GERMAN) == ("fixture.greeting",)


def test_an_empty_plural_form_is_missing(locales: Path) -> None:
    edit_german(locales, 'msgstr[1] "%(n)s Dinge"', 'msgstr[1] ""')

    assert missing_keys(locales, GERMAN) == ("fixture.items",)


def test_missing_keys_come_in_english_order(locales: Path) -> None:
    edit_german(locales, 'msgstr "Hallo {x}"', 'msgstr ""')
    edit_german(locales, 'msgstr "Hallo"', 'msgstr ""')

    assert missing_keys(locales, GERMAN) == ("fixture.greeting", "fixture.braces")


def test_a_translation_that_renames_a_hole_is_missing(locales: Path) -> None:
    edit_german(locales, 'msgstr "Hallo {x}"', 'msgstr "Hallo {y}"')

    assert missing_keys(locales, GERMAN) == ("fixture.braces",)


def test_a_translation_that_drops_or_adds_a_hole_is_missing(locales: Path) -> None:
    edit_german(locales, 'msgstr "Hallo {x}"', 'msgstr "Hallo"')
    assert missing_keys(locales, GERMAN) == ("fixture.braces",)

    edit_german(locales, 'msgstr "Hallo"', 'msgstr "Hallo {x} {z}"')
    assert missing_keys(locales, GERMAN) == ("fixture.greeting", "fixture.braces")


def test_a_translation_that_reorders_its_holes_is_complete(locales: Path) -> None:
    edit_german(locales, 'msgstr "Hallo {x}"', 'msgstr "{x}, hallo"')

    assert missing_keys(locales, GERMAN) == ()


def test_a_language_without_a_po_misses_every_key(locales: Path) -> None:
    assert missing_keys(locales, Language("fr")) == (
        "fixture.greeting",
        "fixture.farewell",
        "fixture.count_percent",
        "fixture.braces",
        "fixture.two_lines",
        "fixture.items",
        "catalog.nothing_to_offer",
        "catalog.indica_line",
        "catalog.aroma_line",
        "catalog.price_per_gram_line",
        "catalog.bulk_line",
    )


def test_an_edit_between_two_calls_is_seen(locales: Path) -> None:
    assert missing_keys(locales, GERMAN) == ()

    edit_german(locales, 'msgstr "Hallo"', 'msgstr ""')

    assert missing_keys(locales, GERMAN) == ("fixture.greeting",)


def test_the_real_english_is_complete() -> None:
    assert missing_keys(REAL_LOCALES, ENGLISH) == ()


def all_po_files() -> list[Path]:
    return sorted([*REAL_LOCALES.rglob("*.po"), *FIXTURE_LOCALES.rglob("*.po")])


def stale_against_its_po(po: Path) -> bool:
    """The staleness check the Gate runs over every committed catalog: parsed messages,
    never bytes, so a recompile that only changes the header never fails it."""
    return po_messages(po) != mo_messages(po.with_suffix(".mo"))


def test_the_staleness_check_covers_non_empty_catalogs() -> None:
    assert any(po_messages(po) for po in all_po_files())


@pytest.mark.parametrize("po", all_po_files(), ids=lambda po: f"{po.parts[-4]}-{po.parts[-3]}")
def test_every_compiled_catalog_matches_its_po(po: Path) -> None:
    assert po.with_suffix(".mo").is_file()
    assert not stale_against_its_po(po)


def test_a_po_edited_without_recompiling_is_stale(locales: Path) -> None:
    po = locales / "de" / "LC_MESSAGES" / "apostrophe.po"
    po.write_text(po.read_text(encoding="utf-8").replace("Hallo", "Servus"), encoding="utf-8")

    assert stale_against_its_po(po)


def test_a_po_marking_an_entry_fuzzy_without_recompiling_is_stale(locales: Path) -> None:
    po = locales / "de" / "LC_MESSAGES" / "apostrophe.po"
    po.write_text(
        po.read_text(encoding="utf-8").replace(
            'msgid "fixture.farewell"', '#, fuzzy\nmsgid "fixture.farewell"'
        ),
        encoding="utf-8",
    )

    assert stale_against_its_po(po)
