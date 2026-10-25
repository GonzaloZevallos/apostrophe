"""The operator's three commands and the import report speak through the operator's
translator and nothing else (docs/adr/0050 and its amendment), at the declared seams:
`accounts.adapters.cli.main`, `business_removal.adapters.cli.main` and the removal use
cases with `OperatorWords`, `spreadsheet_import.adapters.cli.run` and
`report.print_report`, `operator_translator`'s signature and `Settings`.

One run of everything per language, then: a business stored in another language changes no
byte (the translator takes none), the operator language `de` changes every command, and
under `APOSTROPHE_FORCED_LANGUAGE=en-XA` no letter is left outside a `⟦…⟧` segment, the data
or a format token -- and every baseline key was reached.
"""

from __future__ import annotations

import inspect
import json
import re
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import pytest

from app.accounts.adapters.cli import build_parser, main
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import operator_translator
from app.shared.language import ENGLISH, Language
from tests.conftest import NOW, MovableClock
from tests.operator_copy.locales import MARK
from tests.operator_copy.runs import (
    GROUPS,
    Capture,
    Languages,
    normalised,
    run_operator_commands,
)

BASELINE = Path(__file__).resolve().parents[2] / "app" / "shared" / "copy" / "en.baseline.json"
GERMAN = Language("de")
SEGMENT = re.compile(r"⟦.*?⟧")
FORMAT_TOKEN = re.compile(r"\{[A-Za-z_][A-Za-z0-9_]*\}|%[A-Za-z]")
LETTER = re.compile(r"[^\W\d_]")
PLANTED = "Sin traducir"


def baseline_keys() -> set[str]:
    entries: dict[str, dict[str, object]] = json.loads(BASELINE.read_text(encoding="utf-8"))
    return {
        key
        for key, entry in entries.items()
        if key.startswith("operator.") and not entry.get("pending")
    }


def letters_left(text: str, data: set[str]) -> str:
    """What is still a word once the `⟦…⟧` segments, the data and the format tokens go."""
    rest = SEGMENT.sub("", text)
    for value in sorted(data, key=len, reverse=True):
        if value:
            rest = rest.replace(value, "")
    return "".join(LETTER.findall(FORMAT_TOKEN.sub("", rest)))


def untranslated(capture: Capture) -> list[str]:
    return [
        f"{line.group}/{line.scenario}: {line.text}"
        for line in capture.lines
        if letters_left(line.text, capture.data)
    ]


@pytest.fixture
def forced_test_locale(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "en-XA")


def test_a_selectable_language_changes_no_byte_of_the_english_output(
    tmp_path: Path, operator_locales: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    english = run_operator_commands(tmp_path / "en", monkeypatch)
    with_german_offered = run_operator_commands(
        tmp_path / "offered",
        monkeypatch,
        languages=Languages(operator_locales, (ENGLISH, GERMAN), ENGLISH),
    )

    assert english.lines  # something was printed, so the equality below means something
    assert [normalised(line, tmp_path / "en") for line in english.lines] == [
        normalised(line, tmp_path / "offered") for line in with_german_offered.lines
    ]
    assert not any(MARK in line.text for line in with_german_offered.lines)


def test_the_operator_language_de_changes_every_command_and_the_report(
    tmp_path: Path, operator_locales: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    english = run_operator_commands(tmp_path / "en", monkeypatch)
    german = run_operator_commands(
        tmp_path / "de",
        monkeypatch,
        languages=Languages(operator_locales, (ENGLISH, GERMAN), GERMAN),
    )

    for group in GROUPS:
        in_english = [normalised(line, tmp_path / "en") for line in english.of(group)]
        in_german = [normalised(line, tmp_path / "de") for line in german.of(group)]
        assert in_german != in_english, group
        assert any(MARK in line.text for line in german.of(group)), group

    # Per command, not per group: the removal group also holds use-case lines the harness
    # renders itself, which must not stand in for what `removal_cli.main` prints.
    scenarios = {(line.group, line.scenario) for line in german.lines}
    assert scenarios == {(line.group, line.scenario) for line in english.lines}
    for group, scenario in sorted(scenarios):
        german_lines = [line for line in german.of(group) if line.scenario == scenario]
        english_lines = [line for line in english.of(group) if line.scenario == scenario]
        assert any(MARK in line.text for line in german_lines), (group, scenario)
        assert not any(MARK in line.text for line in english_lines), (group, scenario)


def test_under_the_test_locale_no_letter_is_left_outside_a_segment_the_data_or_a_token(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, forced_test_locale: None
) -> None:
    capture = run_operator_commands(tmp_path, monkeypatch)

    assert untranslated(capture) == []
    assert len(capture.lines) > 50


def test_every_baseline_key_is_rendered_by_some_run(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, forced_test_locale: None
) -> None:
    capture = run_operator_commands(tmp_path, monkeypatch)

    assert capture.keys == baseline_keys()


@pytest.mark.parametrize(
    ("group", "key"),
    [
        ("accounts", "operator.accounts.valid_once"),
        ("removal", "operator.removal.count_dry"),
        ("import", "operator.import.refused"),
        ("report", "operator.import.counts_heading"),
    ],
)
def test_a_planted_literal_fails_the_sweep(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    forced_test_locale: None,
    group: str,
    key: str,
) -> None:
    capture = run_operator_commands(tmp_path, monkeypatch, planted={key: PLANTED}, groups=(group,))

    assert any(PLANTED in found for found in untranslated(capture)), key


def test_the_help_of_the_accounts_command_is_the_argparse_frame_plus_the_two_marked_lines(
    monkeypatch: pytest.MonkeyPatch, forced_test_locale: None
) -> None:
    monkeypatch.setenv("COLUMNS", "500")
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    commands = (["--help"], ["invite-business", "--help"], ["reset-password", "--help"])

    def helped(call: object) -> list[str]:
        shown = StringIO()
        with redirect_stdout(shown), pytest.raises(SystemExit):
            assert callable(call)
            call()
        return shown.getvalue().splitlines()

    frame: set[str] = set()
    translated: list[str] = []
    for argv in commands:
        frame.update(helped(lambda argv=argv: build_parser(None).parse_args(argv)))
        translated.extend(helped(lambda argv=argv: main(argv, clock=MovableClock(NOW))))

    extra = [line for line in translated if line not in frame]
    assert len(extra) == 2
    assert all(SEGMENT.search(line) for line in extra)
    assert {line.split()[0] for line in extra} == {"invite-business", "reset-password"}
    for line in extra:
        assert letters_left(line, {"invite-business", "reset-password"}) == ""


def test_the_translator_takes_exactly_the_locales_the_operator_language_and_the_forced_one() -> (
    None
):
    parameters = inspect.signature(operator_translator).parameters

    assert list(parameters) == ["locales_dir", "operator_language", "forced_language"]
    assert all(p.kind is inspect.Parameter.KEYWORD_ONLY for p in parameters.values())
    assert (
        operator_translator(
            locales_dir=DEFAULT_LOCALES_DIR, operator_language=ENGLISH, forced_language=None
        )("operator.accounts.no_user")
        == "no user for that email"
    )
