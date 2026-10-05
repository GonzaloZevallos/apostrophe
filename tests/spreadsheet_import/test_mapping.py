"""`read_mapping` (CODING_STANDARDS.md section 5: tests at the seams)."""

from __future__ import annotations

import csv
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
    phone = "11-2345-6789"
    path = _write(tmp_path, f"name,phone\nAna,{phone},extra\nBeto\n")

    parsed = read_mapping(path)

    assert parsed.entries == ()
    kinds_and_lines = [(p.kind, p.ref.row) for p in parsed.problems]
    assert kinds_and_lines == [("mapping_columns_invalid", 2), ("mapping_columns_invalid", 3)]
    for problem in parsed.problems:
        text = repr(problem)
        assert phone not in text
        assert "Ana" not in text
        assert "Beto" not in text
        assert "extra" not in text


def test_a_malformed_row_is_a_problem_with_no_file_content(tmp_path: Path) -> None:
    phone_digits = "9" * 50
    path = _write(tmp_path, f"name,phone\nAna,{phone_digits}\n")
    default_limit = csv.field_size_limit()
    csv.field_size_limit(10)
    try:
        parsed = read_mapping(path)
    finally:
        csv.field_size_limit(default_limit)

    assert parsed.entries == ()
    [problem] = parsed.problems
    assert problem.kind == "mapping_malformed_row"
    assert problem.ref.row == 2
    text = repr(problem)
    assert phone_digits not in text
    assert "Ana" not in text


def test_a_duplicate_name_is_a_problem_located_by_line_only(tmp_path: Path) -> None:
    path = _write(tmp_path, "name,phone\nAna,11-2345-6789\nAna,11-0000-0000\n")

    parsed = read_mapping(path)

    assert [(e.line, e.name) for e in parsed.entries] == [(2, "Ana")]
    [problem] = parsed.problems
    assert problem.kind == "mapping_duplicate_name"
    assert problem.ref.row == 3


def test_two_lines_differing_only_in_inner_spaces_are_a_duplicate(tmp_path: Path) -> None:
    path = _write(tmp_path, "name,phone\nJuana  Perez,11-2345-6789\nJuana Perez,11-0000-0000\n")

    parsed = read_mapping(path)

    assert [(e.line, e.name) for e in parsed.entries] == [(2, "Juana  Perez")]
    [problem] = parsed.problems
    assert problem.kind == "mapping_duplicate_name"
    assert problem.ref.row == 3


def test_two_lines_differing_only_in_case_are_both_kept(tmp_path: Path) -> None:
    path = _write(tmp_path, "name,phone\njuana perez,11-2345-6789\nJuana Perez,11-0000-0000\n")

    parsed = read_mapping(path)

    assert [(e.line, e.name) for e in parsed.entries] == [(2, "juana perez"), (3, "Juana Perez")]
    assert parsed.problems == ()
