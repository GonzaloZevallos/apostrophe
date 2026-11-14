"""The docs word check (GH-742): README, CONTEXT.md and docs/product never say the old product word.

The rule lives in `docs/product/gate.md`; the pattern and the check live in `word_check.py`.
These tests run it over strings, over a temporary tree, and over the real tree.
"""

from pathlib import Path

import pytest

from scripts.affected import REPO_ROOT
from tests.docs.word_check import (
    EXEMPTIONS,
    Exemption,
    findings,
    is_binary,
    read_tree,
)

PAGE = "docs/product/page.md"
OTHER = "docs/product/other.md"
PHRASE = "Flower Co"
HISTORIC = Exemption(PAGE, PHRASE, "historical name of a supplier, quoted verbatim")


def test_a_planted_word_fails_and_the_message_names_file_line_and_word() -> None:
    report = findings({PAGE: "clean line\nWe sell a flower here\n"}, ())

    assert [(m.path, m.line, m.word) for m in report.matches] == [(PAGE, 2, "flower")]
    assert report.messages()[0].startswith(f"{PAGE}:2:flower")
    assert "describe the product generically" in report.messages()[0]
    assert "EXEMPTIONS" in report.messages()[0]
    assert not report.ok


def test_every_form_of_the_word_is_found_as_written_and_other_words_are_not() -> None:
    text = "Flowers\nFLOR y flores\nflowerpot\nfloral\nreflor\n"

    report = findings({PAGE: text}, ())

    assert [(m.line, m.word) for m in report.matches] == [
        (1, "Flowers"),
        (2, "FLOR"),
        (2, "flores"),
    ]


def test_a_clean_tree_passes() -> None:
    report = findings({PAGE: "Stock and purchases\n"}, ())

    assert report.ok
    assert report.messages() == []


def test_an_exempt_phrase_is_not_a_match() -> None:
    report = findings({PAGE: f"We met {PHRASE} today\n"}, [HISTORIC])

    assert report.ok


def test_a_new_match_in_an_exempt_file_fails() -> None:
    report = findings({PAGE: f"We met {PHRASE} today\nsecond flower line\n"}, [HISTORIC])

    assert [(m.line, m.word) for m in report.matches] == [(2, "flower")]


def test_the_exempt_phrase_plus_a_second_match_on_the_same_line_fails() -> None:
    report = findings({PAGE: f"{PHRASE} sells flowers\n"}, [HISTORIC])

    assert [(m.line, m.word) for m in report.matches] == [(1, "flowers")]


def test_the_same_phrase_exempted_for_another_path_still_fails() -> None:
    report = findings({PAGE: f"{PHRASE}\n", OTHER: f"{PHRASE}\n"}, [HISTORIC])

    assert [(m.path, m.line) for m in report.matches] == [(OTHER, 1)]
    assert report.stale == ()


def test_a_phrase_that_differs_only_in_case_is_not_exempt() -> None:
    report = findings({PAGE: "flower co\n"}, [HISTORIC])

    assert [(m.line, m.word) for m in report.matches] == [(1, "flower")]
    assert [e.phrase for e in report.stale] == [PHRASE]


def test_a_stale_exemption_fails_with_its_own_message() -> None:
    report = findings({PAGE: "nothing here\n"}, [HISTORIC])

    assert report.matches == ()
    assert [e.phrase for e in report.stale] == [PHRASE]
    assert not report.ok
    [message] = report.messages()
    assert PAGE in message
    assert PHRASE in message
    assert "remove" in message


def test_an_exemption_for_a_file_that_is_not_there_is_stale() -> None:
    report = findings({OTHER: "nothing\n"}, [HISTORIC])

    assert [e.path for e in report.stale] == [PAGE]


def test_line_numbers_count_newlines_only() -> None:
    text = "one\x0c still line one\r\nflower on line two\x0b\r\n"

    report = findings({PAGE: text}, ())

    assert [(m.line, m.word) for m in report.matches] == [(2, "flower")]


def test_matches_are_ordered_by_path_then_line_then_position() -> None:
    report = findings({OTHER: "flor\n", PAGE: "x\nflor flower\n"}, ())

    assert [(m.path, m.line, m.word) for m in report.matches] == [
        (OTHER, 1, "flor"),
        (PAGE, 2, "flor"),
        (PAGE, 2, "flower"),
    ]


@pytest.mark.parametrize(
    ("path", "phrase", "reason", "complaint"),
    [
        (PAGE, PHRASE, "", "reason"),
        (PAGE, PHRASE, "   ", "reason"),
        (PAGE, "", "why", "phrase"),
        (PAGE, " \t", "why", "phrase"),
        ("", PHRASE, "why", "path"),
        ("  ", PHRASE, "why", "path"),
        (PAGE, "Flower\nCo", "why", "newline"),
        (PAGE, "Garden Co", "why", "does not match"),
    ],
)
def test_an_exemption_is_rejected_when_it_is_incomplete_or_cannot_apply(
    path: str, phrase: str, reason: str, complaint: str
) -> None:
    with pytest.raises(ValueError, match=complaint):
        Exemption(path, phrase, reason)


def test_is_binary_looks_for_a_nul_in_the_first_8000_bytes() -> None:
    assert is_binary(b"\x89PNG\r\n\x1a\n\x00\x00")
    assert not is_binary(b"plain text")
    assert not is_binary(b"a" * 8000 + b"\x00")
    assert is_binary(b"a" * 7999 + b"\x00")


def make(root: Path, relative: str, data: bytes | str) -> None:
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        target.write_text(data, encoding="utf-8")
    else:
        target.write_bytes(data)


def test_read_tree_reads_text_files_of_any_extension_and_skips_a_png(tmp_path: Path) -> None:
    make(tmp_path, "README.md", "readme\n")
    make(tmp_path, "CONTEXT.md", "context\n")
    make(tmp_path, "docs/product/b.md", "b\n")
    make(tmp_path, "docs/product/design-system/dominio.ts", "export const x = 1\n")
    make(tmp_path, "docs/product/design-system/data.json", '{"a": 1}\n')
    make(tmp_path, "docs/product/design-system/logo.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00")
    make(tmp_path, "docs/other/elsewhere.md", "flower\n")
    make(tmp_path, "app/x.py", "flower\n")

    files, skipped = read_tree(tmp_path)

    assert list(files) == [
        "CONTEXT.md",
        "README.md",
        "docs/product/b.md",
        "docs/product/design-system/data.json",
        "docs/product/design-system/dominio.ts",
    ]
    assert files["docs/product/design-system/dominio.ts"] == "export const x = 1\n"
    assert skipped == 1


def test_read_tree_ignores_dotfiles_and_dot_directories(tmp_path: Path) -> None:
    make(tmp_path, "docs/product/a.md", "a\n")
    make(tmp_path, "docs/product/.hidden.md", "flower\n")
    make(tmp_path, "docs/product/.cache/x.md", "flower\n")
    make(tmp_path, "docs/product/sub/.git/y.md", "flower\n")

    files, skipped = read_tree(tmp_path)

    assert list(files) == ["docs/product/a.md"]
    assert skipped == 0


def test_read_tree_decodes_invalid_utf8_with_replacement(tmp_path: Path) -> None:
    make(tmp_path, "docs/product/a.md", b"caf\xe9 flower\n")

    files, _ = read_tree(tmp_path)

    assert files["docs/product/a.md"] == "caf� flower\n"
    assert [m.word for m in findings(files, ()).matches] == ["flower"]


def test_read_tree_tolerates_a_missing_file_or_directory(tmp_path: Path) -> None:
    make(tmp_path, "README.md", "readme\n")

    files, skipped = read_tree(tmp_path)

    assert list(files) == ["README.md"]
    assert skipped == 0


def test_a_word_planted_in_a_tree_turns_the_check_red(tmp_path: Path) -> None:
    make(tmp_path, "docs/product/page.md", "line one\nsell a flower\n")

    files, _ = read_tree(tmp_path)
    report = findings(files, ())

    assert report.messages()[0].startswith("docs/product/page.md:2:flower")


def test_the_real_tree_has_no_match_and_no_stale_exemption() -> None:
    files, _ = read_tree(REPO_ROOT)

    report = findings(files, EXEMPTIONS)

    assert report.messages() == []
    assert "README.md" in files
    assert "CONTEXT.md" in files
    assert any(path.startswith("docs/product/") for path in files)


def test_exemptions_stay_empty() -> None:
    assert EXEMPTIONS == ()
