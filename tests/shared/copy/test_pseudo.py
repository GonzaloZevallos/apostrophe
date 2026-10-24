import math
import re
import shutil
from pathlib import Path

import pytest

from app.shared.copy import catalog_map, po_text, pseudo_catalog, read_catalog
from app.shared.copy.messages import MessageId, MessageValue, po_path
from scripts import copy_report, pseudo_locale

FIXTURE_LOCALES = Path(__file__).resolve().parents[2] / "fixtures" / "locales"
REAL_LOCALES = Path(__file__).resolve().parents[3] / "app" / "shared" / "copy" / "locales"
PLACEHOLDER = re.compile(r"%%|%\(\w+\)s|%s|%d|\{\w+\}")
OPEN, CLOSE = "⟦", "⟧"


Messages = dict[MessageId, tuple[MessageValue, tuple[str, ...]]]


def english_map(tmp_path: Path, body: str) -> Messages:
    """The `en-XA` messages of an English `.po` made of `body`."""
    english = tmp_path / "en.po"
    english.write_text(
        'msgid ""\nmsgstr ""\n"Plural-Forms: nplurals=2; plural=(n != 1);\\n"\n\n' + body,
        encoding="utf-8",
    )
    return catalog_map(pseudo_catalog(read_catalog(english)))


def value_of(tmp_path: Path, text: str) -> str:
    """The `en-XA` value of the English message `text`."""
    messages = english_map(tmp_path, f'msgid "k"\nmsgstr "{text}"\n')
    value, flags = messages["k"]
    assert flags == ()
    assert isinstance(value, str)
    return value


def inner(value: str) -> str:
    assert value.startswith(OPEN)
    assert value.endswith(CLOSE)
    return value[1:-1]


def plain_length(text: str) -> int:
    return len(PLACEHOLDER.sub("", text))


def test_a_value_is_wrapped_and_accented(tmp_path: Path) -> None:
    value = value_of(tmp_path, "Hello")

    assert value.startswith("⟦Ĥèłłö")
    assert value.endswith(CLOSE)
    assert "Hello" not in value


@pytest.mark.parametrize(
    "text",
    [
        "Hello there, friend",
        "Total %(n)s of %(m)s, 100%% sure",
        "Pay %s now, %d left",
        "Hello {x} and {y_2}",
        "Twelve characters",
        "Ten chars!",
    ],
)
def test_a_value_grows_by_about_a_third_and_keeps_every_placeholder(
    tmp_path: Path, text: str
) -> None:
    value = value_of(tmp_path, text)

    assert PLACEHOLDER.findall(value) == PLACEHOLDER.findall(text)
    ratio = plain_length(inner(value)) / plain_length(text)
    assert 1.30 <= ratio <= 1.45
    assert plain_length(inner(value)) - plain_length(text) == math.ceil(0.35 * plain_length(text))


def test_a_placeholder_is_never_accented(tmp_path: Path) -> None:
    value = value_of(tmp_path, "Name %(name)s and {name}")

    assert "%(name)s" in value
    assert "{name}" in value


def test_an_empty_value_stays_empty(tmp_path: Path) -> None:
    assert value_of(tmp_path, "") == ""


def test_a_newline_is_kept(tmp_path: Path) -> None:
    messages = english_map(tmp_path, 'msgid "k"\nmsgstr ""\n"First line\\n"\n"Second line"\n')
    value, _flags = messages["k"]

    assert isinstance(value, str)
    assert value.count("\n") == 1


def test_each_plural_form_is_changed_on_its_own(tmp_path: Path) -> None:
    messages = english_map(
        tmp_path,
        'msgid "one"\nmsgid_plural "many"\nmsgstr[0] "%(n)s item"\nmsgstr[1] "%(n)s items"\n',
    )
    value, flags = messages[("one", "many")]

    assert flags == ()
    assert isinstance(value, tuple)
    assert len(value) == 2
    assert all(form.startswith(OPEN) and form.endswith(CLOSE) for form in value)
    assert all("%(n)s" in form for form in value)
    assert value[0] != value[1]


def test_two_runs_give_equal_output(tmp_path: Path) -> None:
    english = read_catalog(po_path(FIXTURE_LOCALES, "en"))

    assert po_text(pseudo_catalog(english)) == po_text(pseudo_catalog(english))
    assert catalog_map(pseudo_catalog(english)) == catalog_map(pseudo_catalog(english))


def committed_matches_the_generator(locales: Path) -> bool:
    """The staleness check the Gate runs: parsed messages, never bytes."""
    generated = catalog_map(pseudo_catalog(read_catalog(po_path(locales, "en"))))
    return catalog_map(read_catalog(po_path(locales, "en-XA"))) == generated


@pytest.mark.parametrize("locales", [REAL_LOCALES, FIXTURE_LOCALES], ids=["real", "fixture"])
def test_the_committed_test_locale_is_what_the_generator_writes(locales: Path) -> None:
    assert committed_matches_the_generator(locales)


def test_the_fixture_test_locale_is_not_empty() -> None:
    assert catalog_map(read_catalog(po_path(FIXTURE_LOCALES, "en-XA")))


@pytest.fixture
def fixture_copy(tmp_path: Path) -> Path:
    target = tmp_path / "locales"
    shutil.copytree(FIXTURE_LOCALES, target)
    return target


def test_a_test_locale_missing_a_message_is_stale(fixture_copy: Path) -> None:
    po = po_path(fixture_copy, "en-XA")
    text = po.read_text(encoding="utf-8")
    start = text.index('msgid "fixture.farewell"')
    end = text.index('msgid "fixture.count_percent"')
    po.write_text(text[:start] + text[end:], encoding="utf-8")

    assert not committed_matches_the_generator(fixture_copy)


def test_a_test_locale_with_an_edited_message_is_stale(fixture_copy: Path) -> None:
    po = po_path(fixture_copy, "en-XA")
    po.write_text(po.read_text(encoding="utf-8").replace("⟦", "[", 1), encoding="utf-8")

    assert not committed_matches_the_generator(fixture_copy)


def test_a_test_locale_with_a_fuzzy_message_is_stale(fixture_copy: Path) -> None:
    po = po_path(fixture_copy, "en-XA")
    po.write_text(
        po.read_text(encoding="utf-8").replace(
            'msgid "fixture.greeting"', '#, fuzzy\nmsgid "fixture.greeting"'
        ),
        encoding="utf-8",
    )

    assert not committed_matches_the_generator(fixture_copy)


def test_the_script_writes_the_po_and_mo_of_the_test_locale(tmp_path: Path) -> None:
    locales = tmp_path / "locales"
    shutil.copytree(FIXTURE_LOCALES / "en", locales / "en")

    assert pseudo_locale.main(locales) == 0

    written = catalog_map(read_catalog(po_path(locales, "en-XA")))
    assert written == catalog_map(read_catalog(po_path(FIXTURE_LOCALES, "en-XA")))
    assert po_path(locales, "en-XA").with_suffix(".mo").is_file()


def test_the_script_reproduces_the_committed_files(tmp_path: Path) -> None:
    locales = tmp_path / "locales"
    shutil.copytree(FIXTURE_LOCALES / "en", locales / "en")

    pseudo_locale.main(locales)

    committed = po_path(FIXTURE_LOCALES, "en-XA")
    assert po_path(locales, "en-XA").read_text(encoding="utf-8") == committed.read_text(
        encoding="utf-8"
    )


def test_the_report_script_lists_the_missing_keys_and_returns_zero(
    fixture_copy: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    po = po_path(fixture_copy, "de")
    po.write_text(
        po.read_text(encoding="utf-8").replace('msgstr "Auf Wiedersehen"', 'msgstr ""'),
        encoding="utf-8",
    )

    assert copy_report.main(fixture_copy) == 0

    lines = capsys.readouterr().out.splitlines()
    assert lines == ["de: 1 missing", "  fixture.farewell"]


def test_the_report_script_returns_zero_when_nothing_is_missing(
    fixture_copy: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert copy_report.main(fixture_copy) == 0

    assert capsys.readouterr().out.splitlines() == ["de: 0 missing"]
