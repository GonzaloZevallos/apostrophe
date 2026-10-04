"""`read_mapping` (CODING_STANDARDS.md section 5: tests at the seams)."""

from __future__ import annotations

from pathlib import Path

from app.spreadsheet_import.adapters.mapping import read_mapping


def _write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "mapping.csv"
    path.write_text(text, encoding="utf-8")
    return path


def test_valid_entries_are_read_with_their_line_number(tmp_path: Path) -> None:
    path = _write(tmp_path, "name,phone\nAna,11-2345-6789\nBeto,11-9876-5432\n")

    parsed = read_mapping(path)

    assert [(e.line, e.name, e.phone) for e in parsed.entries] == [
        (2, "Ana", "11-2345-6789"),
        (3, "Beto", "11-9876-5432"),
    ]
    assert parsed.problems == ()


def test_a_bad_header_is_a_problem_located_by_line_only(tmp_path: Path) -> None:
    path = _write(tmp_path, "nombre,telefono\nAna,11-2345-6789\n")

    parsed = read_mapping(path)

    assert parsed.entries == ()
    [problem] = parsed.problems
    assert problem.kind == "mapping_header_invalid"
    assert problem.ref.row == 1


def test_a_wrong_column_count_is_a_problem_with_no_file_content(tmp_path: Path) -> None:
    path = _write(tmp_path, "name,phone\nAna,11-2345-6789,extra\nBeto\n")

    parsed = read_mapping(path)

    assert parsed.entries == ()
    kinds_and_lines = [(p.kind, p.ref.row) for p in parsed.problems]
    assert kinds_and_lines == [("mapping_columns_invalid", 2), ("mapping_columns_invalid", 3)]
    full_text = "11-2345-6789 Ana Beto extra"
    for problem in parsed.problems:
        assert problem.column not in full_text
        assert problem.kind not in full_text


def test_a_duplicate_name_is_a_problem_located_by_line_only(tmp_path: Path) -> None:
    path = _write(tmp_path, "name,phone\nAna,11-2345-6789\nAna,11-0000-0000\n")

    parsed = read_mapping(path)

    assert [(e.line, e.name) for e in parsed.entries] == [(2, "Ana")]
    [problem] = parsed.problems
    assert problem.kind == "mapping_duplicate_name"
    assert problem.ref.row == 3
