"""The ADR index is generated from the front matter of `docs/adr/*.md` (GH-692).

The reader, the generator over throwaway directories, and the key set of every real ADR.
Reads of the repo's docs are literal `REPO_ROOT / "docs" / ...` chains.
"""

from __future__ import annotations

import datetime
import json
from pathlib import Path

import pytest
import yaml

from scripts.docs.adr_ids import SUPERSEDED_MARK
from scripts.docs.adr_index import INTRO, AdrIndexError, index_text, read_front_matter

REPO_ROOT = Path(__file__).resolve().parents[2]

# The keys every ADR has, and the keys one ADR carries on top of them, by file name.
BASE_KEYS = {"status", "date", "summary"}
EXTRA_KEYS = {"0017-deploying-render-turso-backups-and-the-restore-drill.md": {"amended"}}


def _adr(
    directory: Path, name: str, summary: str | None = "una frase", status: str = "accepted"
) -> None:
    lines = ["---", f"status: {status}", "date: 2026-10-02"]
    if summary is not None:
        lines.append(f"summary: {summary}")
    (directory / name).write_text("\n".join([*lines, "---", "", "# T", ""]), encoding="utf-8")


# --- read_front_matter ------------------------------------------------------------------


def test_a_text_without_front_matter_reads_as_empty() -> None:
    assert read_front_matter("# 0032. Title\n\nStatus: accepted\n") == {}
    assert read_front_matter("") == {}


def test_a_body_with_its_own_rule_line_is_not_part_of_the_block() -> None:
    text = "---\nstatus: accepted\n---\n\nbody\n\n---\n\nkey: not a key\n"

    assert read_front_matter(text) == {"status": "accepted"}


def test_a_colon_heavy_value_comes_back_as_written() -> None:
    text = '---\nsummary: "a: b, `c`, \\"d\\" y e: f"\n---\n'

    assert read_front_matter(text) == {"summary": 'a: b, `c`, "d" y e: f'}


def test_a_date_comes_back_as_text_and_the_shared_loader_is_untouched() -> None:
    assert yaml.safe_load("d: 2026-10-02")["d"] == datetime.date(2026, 10, 2)
    assert read_front_matter("---\ndate: 2026-10-02\n---\n") == {"date": "2026-10-02"}
    assert yaml.safe_load("d: 2026-10-02")["d"] == datetime.date(2026, 10, 2)


def test_an_unclosed_block_is_rejected() -> None:
    with pytest.raises(ValueError, match="front matter is not closed"):
        read_front_matter("---\nstatus: accepted\n")


@pytest.mark.parametrize("value", ["[a, b]", "{a: b}"])
def test_a_list_or_map_value_is_rejected_naming_the_key(value: str) -> None:
    with pytest.raises(ValueError, match="'amended'"):
        read_front_matter(f"---\nstatus: accepted\namended: {value}\n---\n")


def test_a_block_that_is_not_a_mapping_is_rejected() -> None:
    with pytest.raises(ValueError, match="not a mapping"):
        read_front_matter("---\n- a\n- b\n---\n")


# --- index_text -------------------------------------------------------------------------


def test_a_row_has_the_id_the_link_and_the_summary_and_no_mark_when_accepted(
    tmp_path: Path,
) -> None:
    _adr(tmp_path, "0001-a.md", summary='"uno"')

    assert index_text(tmp_path) == INTRO + "| [0001](../adr/0001-a.md) | uno |  |\n"


def test_an_adr_without_a_summary_is_rejected_naming_the_file(tmp_path: Path) -> None:
    _adr(tmp_path, "0001-a.md")
    _adr(tmp_path, "0002-b.md", summary=None)

    with pytest.raises(AdrIndexError, match=r"^0002-b\.md: summary is missing or empty$"):
        index_text(tmp_path)


def test_an_empty_summary_is_rejected_naming_the_file(tmp_path: Path) -> None:
    _adr(tmp_path, "0002-b.md", summary='""')

    with pytest.raises(AdrIndexError, match=r"^0002-b\.md: summary is missing or empty$"):
        index_text(tmp_path)


@pytest.mark.parametrize(
    ("summary", "what"),
    [('"a | b"', "a pipe"), ('"a\\nb"', "a line break"), ('"a\\rb"', "a line break")],
)
def test_a_summary_that_would_break_the_row_is_rejected(
    tmp_path: Path, summary: str, what: str
) -> None:
    _adr(tmp_path, "0003-c.md", summary=summary)

    with pytest.raises(AdrIndexError, match=rf"^0003-c\.md: summary holds {what}$"):
        index_text(tmp_path)


def test_an_unknown_status_is_rejected_naming_the_file(tmp_path: Path) -> None:
    _adr(tmp_path, "0004-d.md", status="draft")

    with pytest.raises(AdrIndexError, match=r"^0004-d\.md: unknown status 'draft'$"):
        index_text(tmp_path)


def test_a_front_matter_that_does_not_parse_is_rejected_naming_the_file(tmp_path: Path) -> None:
    (tmp_path / "0005-e.md").write_text("---\nstatus: accepted\n", encoding="utf-8")

    with pytest.raises(AdrIndexError, match=r"^0005-e\.md: front matter is not closed$"):
        index_text(tmp_path)


def test_a_superseded_adr_gets_the_mark_the_checks_read_back(tmp_path: Path) -> None:
    _adr(tmp_path, "0001-a.md", status="superseded by 20261111-b")
    _adr(tmp_path, "20261111-b.md")

    page = index_text(tmp_path)
    mark = next(line for line in page.splitlines() if "0001-a.md" in line)

    assert mark == "| [0001](../adr/0001-a.md) | una frase | reemplazada por 20261111-b |"
    found = SUPERSEDED_MARK.search(mark)
    assert found is not None
    assert found.group(1) == "20261111-b"


def test_rows_are_sorted_by_file_name_the_legacy_ones_before_the_dated(tmp_path: Path) -> None:
    for name in ("20261112-x.md", "0010-j.md", "20261111-y.md", "0002-b.md"):
        _adr(tmp_path, name)

    rows = [line.split(" | ")[0] for line in index_text(tmp_path).splitlines()[-4:]]

    assert rows == [
        "| [0002](../adr/0002-b.md)",
        "| [0010](../adr/0010-j.md)",
        "| [20261111-y](../adr/20261111-y.md)",
        "| [20261112-x](../adr/20261112-x.md)",
    ]


def test_a_summary_with_colons_backticks_and_quotes_reaches_the_page_as_written(
    tmp_path: Path,
) -> None:
    sentence = 'regla `a: b` y "citas" dentro: sí'
    _adr(tmp_path, "0001-a.md", summary=json.dumps(sentence, ensure_ascii=False))

    assert f"| {sentence} |" in index_text(tmp_path)


def test_the_same_directory_gives_the_same_page_twice(tmp_path: Path) -> None:
    _adr(tmp_path, "0001-a.md")

    assert index_text(tmp_path) == index_text(tmp_path)


# --- the real ADRs ----------------------------------------------------------------------


def test_every_adr_parses_to_the_agreed_keys() -> None:
    parsed = {
        path.name: set(read_front_matter(path.read_text(encoding="utf-8")))
        for path in sorted((REPO_ROOT / "docs" / "adr").glob("*.md"))
    }

    assert parsed
    assert parsed == {name: BASE_KEYS | EXTRA_KEYS.get(name, set()) for name in parsed}
