"""`scripts/ci_coverage.py`: the Markdown report and the baseline command, over fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.ci_coverage import (
    BASELINE_MARKER,
    MARKER,
    Selection,
    main,
    parse_baseline,
    parse_selection,
    report,
)

FIXTURES = Path(__file__).parent / "fixtures" / "ci_coverage"
AREAS = frozenset({"accounts", "catalog", "ledger"})


def _json(name: str) -> dict[str, object]:
    loaded: dict[str, object] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return loaded


def _baseline() -> dict[str, float]:
    return parse_baseline((FIXTURES / "baseline.md").read_text(encoding="utf-8"))


def _selection(*, selected: frozenset[str], pytest: bool = True, vitest: bool = True) -> Selection:
    return Selection(pytest=pytest, vitest=vitest, e2e=False, areas=AREAS, selected=selected)


def _rows(markdown: str) -> dict[str, list[str]]:
    rows: dict[str, list[str]] = {}
    for line in markdown.splitlines():
        if (
            line.startswith("| ")
            and not line.startswith("| ---")
            and not line.startswith("| Scope")
        ):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            rows[cells[0]] = cells[1:]
    return rows


def test_report_starts_with_the_marker_the_workflow_updates_the_comment_by() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        _json("vitest_summary.json"),
        _selection(selected=AREAS),
        None,
    )

    assert markdown.startswith(MARKER + "\n")


def test_an_area_that_ran_shows_its_percentage_summed_from_its_files() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        _json("vitest_summary.json"),
        _selection(selected=AREAS),
        None,
    )

    rows = _rows(markdown)
    assert rows["app/accounts"] == ["90.0%"]
    assert rows["app/catalog"] == ["50.0%"]
    assert rows["pytest"] == ["60.0%"]
    assert rows["vitest"] == ["75.0%"]


def test_an_incidental_area_and_one_with_no_lines_both_read_not_run() -> None:
    selection = Selection(
        pytest=True,
        vitest=True,
        e2e=False,
        areas=AREAS | {"billing"},
        selected=frozenset({"accounts"}),
    )

    rows = _rows(
        report(_json("pytest_coverage.json"), _json("vitest_summary.json"), selection, None)
    )

    assert rows["app/accounts"] == ["90.0%"]
    assert rows["app/catalog"] == ["not run"]  # lines in the JSON, tests not selected
    assert rows["app/billing"] == ["not run"]  # neither
    assert "50.0" not in "".join(rows["app/catalog"])


def test_the_state_comes_from_the_selection_not_from_the_json() -> None:
    selection = _selection(selected=frozenset({"accounts", "ledger"}))
    without_ledger = _json("pytest_coverage.json")
    files = without_ledger["files"]
    assert isinstance(files, dict)
    del files["app/ledger/service.py"]

    rows = _rows(report(without_ledger, _json("vitest_summary.json"), selection, None))

    assert rows["app/ledger"] == ["–"]  # selected, but the JSON has no lines for it


def test_a_partial_run_is_marked_and_has_no_delta_column() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        _json("vitest_summary.json"),
        _selection(selected=frozenset({"accounts"})),
        _baseline(),
    )

    assert "Partial run" in markdown
    assert "Delta" not in markdown
    assert _rows(markdown)["app/accounts"] == ["90.0%"]


def test_a_run_without_vitest_is_partial_and_shows_it_as_not_run() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        None,
        _selection(selected=AREAS, vitest=False),
        _baseline(),
    )

    assert "Partial run" in markdown
    assert "Delta" not in markdown
    assert _rows(markdown)["vitest"] == ["not run"]


def test_a_full_run_with_a_baseline_shows_deltas() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        _json("vitest_summary.json"),
        _selection(selected=AREAS),
        _baseline(),
    )

    rows = _rows(markdown)
    assert "Partial run" not in markdown
    assert "Delta" in markdown
    assert rows["pytest"] == ["60.0%", "+5.0"]
    assert rows["vitest"] == ["75.0%", "-5.0"]
    assert rows["app/accounts"] == ["90.0%", "+5.0"]
    assert rows["app/ledger"] == ["25.0%", "-5.0"]


def test_a_full_run_without_a_baseline_has_no_delta_column() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        _json("vitest_summary.json"),
        _selection(selected=AREAS),
        None,
    )

    assert "Partial run" not in markdown
    assert "Delta" not in markdown
    assert _rows(markdown)["pytest"] == ["60.0%"]


def test_a_suite_that_ran_without_a_report_says_so() -> None:
    rows = _rows(report(_json("pytest_coverage.json"), None, _selection(selected=AREAS), None))

    assert rows["vitest"] == ["no report"]


def test_an_absent_pytest_suite_reads_not_run_for_every_area() -> None:
    selection = _selection(selected=frozenset(), pytest=False)

    rows = _rows(report(None, _json("vitest_summary.json"), selection, None))

    assert rows["pytest"] == ["not run"]
    assert {rows[f"app/{area}"][0] for area in AREAS} == {"not run"}


def test_the_report_prints_paths_and_percentages_only() -> None:
    markdown = report(
        _json("pytest_coverage.json"),
        _json("vitest_summary.json"),
        _selection(selected=AREAS),
        _baseline(),
    )

    assert "service.py" not in markdown
    assert "web/src" not in markdown
    assert "150" not in markdown and "200" not in markdown  # vitest line counts


def test_parse_selection_reads_string_flags_and_area_lists() -> None:
    selection = parse_selection(
        {
            "pytest": "true",
            "vitest": "false",
            "e2e": "false",
            "areas": ["accounts", "catalog"],
            "selected": ["accounts"],
        }
    )

    assert selection == Selection(
        pytest=True,
        vitest=False,
        e2e=False,
        areas=frozenset({"accounts", "catalog"}),
        selected=frozenset({"accounts"}),
    )


def test_baseline_command_writes_the_baseline_into_the_given_path(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "coverage.json").write_text(
        (FIXTURES / "pytest_coverage.json").read_text(encoding="utf-8"), encoding="utf-8"
    )
    (reports / "coverage-summary.json").write_text(
        (FIXTURES / "vitest_summary.json").read_text(encoding="utf-8"), encoding="utf-8"
    )
    output = tmp_path / "docs" / "ci" / "coverage-baseline.md"

    status = main(["baseline", str(reports), "--output", str(output)])

    written = output.read_text(encoding="utf-8")
    assert status == 0
    assert written.startswith(BASELINE_MARKER)
    assert parse_baseline(written) == {
        "pytest": 60.0,
        "vitest": 75.0,
        "app/accounts": 90.0,
        "app/catalog": 50.0,
        "app/ledger": 25.0,
    }
    assert capsys.readouterr().out.strip() == str(output)


def test_report_command_prints_the_markdown_for_a_selection_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    selection = tmp_path / "selection.json"
    selection.write_text(
        json.dumps(
            {
                "pytest": "true",
                "vitest": "true",
                "e2e": "false",
                "areas": sorted(AREAS),
                "selected": sorted(AREAS),
            }
        ),
        encoding="utf-8",
    )

    status = main(
        [
            "report",
            "--selection",
            str(selection),
            "--pytest-json",
            str(FIXTURES / "pytest_coverage.json"),
            "--vitest-summary",
            str(FIXTURES / "vitest_summary.json"),
            "--baseline",
            str(FIXTURES / "baseline.md"),
        ]
    )

    out = capsys.readouterr().out
    assert status == 0
    assert out.startswith(MARKER)
    assert "+5.0" in out


def test_report_command_without_a_selection_file_refuses(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    status = main(["report", "--selection", str(tmp_path / "missing.json")])

    assert status == 1
    assert "no selection at" in capsys.readouterr().err
