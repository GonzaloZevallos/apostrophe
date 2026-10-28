"""The coverage text of a CI run (scripts/ci_coverage.py, ADR-0055).

The seam is `render` (coverage data in, Markdown out): the job summary and the PR comment are
that one text. The data are read from fixtures of one real run of each tool, kept per file:

- `ci_coverage/pytest-coverage.json`: `coverage json` after `pytest --cov` over the checkout
  (relative paths, `relative_files`), with the line lists dropped and only some areas kept.
- `ci_coverage/vitest-coverage-summary.json`: `vitest run --coverage` (`json-summary`),
  with the runner's checkout prefix `/home/runner/work/apostrophe/apostrophe`.

`combine_pytest` is run on data a real `coverage run` wrote in a temporary checkout."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.ci_changes import GROUPS, coverage_artifact
from scripts.ci_coverage import (
    ALWAYS_GROUP,
    COMMENT_MARKER,
    Baseline,
    Counts,
    Suite,
    combine_pytest,
    group_dirs,
    main,
    parse_baseline,
    read_baseline,
    read_pytest_json,
    read_vitest_summary,
    render,
)

FIXTURES = Path(__file__).parent / "fixtures" / "ci_coverage"
RUNNER = Path("/home/runner/work/apostrophe/apostrophe")


def _pytest_areas() -> dict[str, Counts]:
    return read_pytest_json((FIXTURES / "pytest-coverage.json").read_text())


def _vitest_areas() -> dict[str, Counts]:
    return read_vitest_summary((FIXTURES / "vitest-coverage-summary.json").read_text(), RUNNER)


def _full() -> tuple[Suite, Suite]:
    return Suite(_pytest_areas(), len(GROUPS), len(GROUPS)), Suite(_vitest_areas())


def _baseline_from(pytest_suite: Suite, vitest_suite: Suite) -> Baseline:
    return parse_baseline(render(pytest_suite, vitest_suite, {}))


def _row(text: str, suite: str, area: str) -> list[str]:
    """The cells of the `area` row of the table under the `suite` heading."""
    section = text.split(f"#### {suite}")[1].split("####")[0]
    for line in section.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if line.startswith("|") and cells[0] == area:
            return cells
    raise AssertionError(f"no row {area!r} under {suite}")


# --- reading what the tools wrote ----------------------------------------------------------


def test_pytest_json_is_counted_per_app_area() -> None:
    areas = _pytest_areas()
    assert {"shared", "varieties", "sales", "(root)"} <= set(areas)
    assert all(counts.total >= counts.covered >= 0 for counts in areas.values())
    assert areas["varieties"].total > 0


def test_vitest_summary_is_counted_per_directory_with_the_checkout_stripped() -> None:
    areas = _vitest_areas()
    assert {"format", "domain", "screens", "(root)"} <= set(areas)
    # Without the checkout given, the prefix is found from `web/src/`: the same answer.
    bare = read_vitest_summary((FIXTURES / "vitest-coverage-summary.json").read_text())
    assert bare == areas


def test_vitest_paths_outside_web_src_are_left_out() -> None:
    text = json.dumps(
        {
            "total": {"lines": {"total": 9, "covered": 9}},
            "/home/runner/work/x/x/web/src/format/a.ts": {"lines": {"total": 4, "covered": 3}},
            "/home/runner/work/x/x/web/e2e/flow.spec.ts": {"lines": {"total": 4, "covered": 4}},
        }
    )
    assert read_vitest_summary(text) == {"format": Counts(3, 4)}


def test_pytest_json_leaves_out_what_is_not_under_app() -> None:
    summary = {"covered_lines": 1, "num_statements": 2}
    text = json.dumps(
        {"files": {"tests/test_x.py": {"summary": summary}, "app/a/b.py": {"summary": summary}}}
    )
    assert read_pytest_json(text) == {"a": Counts(1, 2)}


# --- the Markdown --------------------------------------------------------------------------


def test_a_full_run_shows_every_area_and_both_totals_against_the_baseline() -> None:
    pytest_suite, vitest_suite = _full()
    shrunk = {
        **pytest_suite.areas,
        "varieties": Counts(pytest_suite.areas["varieties"].covered - 10, 0)
        + Counts(0, pytest_suite.areas["varieties"].total),
    }
    baseline = _baseline_from(Suite(shrunk, 1, 1), vitest_suite)
    text = render(pytest_suite, vitest_suite, baseline)
    assert text.startswith(f"{COMMENT_MARKER}\n### Coverage")
    assert "Partial" not in text and "No baseline" not in text
    for area, counts in pytest_suite.areas.items():
        assert _row(text, "pytest", area)[1:3] == [str(counts.covered), str(counts.total)]
    assert _row(text, "pytest", "varieties")[4].startswith("+")
    assert _row(text, "pytest", "sales")[4] == "+0.0"
    assert _row(text, "vitest", "Total")[4] == "+0.0"
    total = pytest_suite.total
    assert _row(text, "pytest", "Total")[:4] == [
        "Total",
        str(total.covered),
        str(total.total),
        f"{total.pct:.1f}%",
    ]


def test_a_partial_run_is_labelled_and_compared_only_per_area() -> None:
    pytest_suite, vitest_suite = _full()
    baseline = _baseline_from(pytest_suite, vitest_suite)
    partial = Suite({"varieties": pytest_suite.areas["varieties"]}, 3, len(GROUPS))
    text = render(partial, vitest_suite, baseline)
    assert f"Partial: 3 of {len(GROUPS)} areas" in text
    assert _row(text, "pytest", "varieties")[4] == "+0.0"
    assert _row(text, "pytest", "Total")[4] == "–"
    # The label is about pytest's groups: vitest has none and stays complete.
    assert text.count("Partial") == 1


def test_a_partial_run_reports_an_area_the_baseline_lacks_as_new() -> None:
    pytest_suite, vitest_suite = _full()
    baseline = _baseline_from(Suite({"sales": pytest_suite.areas["sales"]}, 1, 1), vitest_suite)
    text = render(Suite(pytest_suite.areas, 2, 5), vitest_suite, baseline)
    assert _row(text, "pytest", "varieties")[4] == "new"
    assert _row(text, "pytest", "sales")[4] == "+0.0"


def test_without_a_baseline_the_output_is_complete() -> None:
    pytest_suite, vitest_suite = _full()
    text = render(pytest_suite, vitest_suite, None)
    assert "No baseline yet" in text
    for suite_name, suite in (("pytest", pytest_suite), ("vitest", vitest_suite)):
        for area in suite.areas:
            assert _row(text, suite_name, area)[4] == "–"
        assert _row(text, suite_name, "Total")[1] == str(suite.total.covered)


def test_a_missing_baseline_file_reads_as_none_and_main_still_prints_everything(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    missing = tmp_path / "docs" / "coverage-baseline.md"
    assert read_baseline(missing) is None
    code = main(
        [
            "--vitest",
            str(FIXTURES / "vitest-coverage-summary.json"),
            "--baseline",
            str(missing),
            "--checkout",
            str(RUNNER),
        ]
    )
    out = capsys.readouterr().out
    assert code == 0
    assert "No baseline yet" in out
    assert _row(out, "vitest", "Total")[1] != "0"
    assert "Skipped" in out.split("#### pytest")[1].split("####")[0]


def test_a_suite_that_did_not_run_is_said_to_be_skipped() -> None:
    text = render(None, None, None)
    assert text.count("Skipped: the change does not affect this suite.") == 2


def test_the_baseline_is_what_render_wrote() -> None:
    pytest_suite, vitest_suite = _full()
    baseline = parse_baseline(f"Some prose.\n\n{render(pytest_suite, vitest_suite, None)}")
    assert dict(baseline["pytest"]) == {**pytest_suite.areas, "Total": pytest_suite.total}
    assert dict(baseline["vitest"]) == {**vitest_suite.areas, "Total": vitest_suite.total}


def test_a_baseline_with_nothing_to_read_gives_no_rows() -> None:
    assert parse_baseline("# Coverage\n\nNothing was recorded.\n") == {}


def test_map_lag_is_a_warning_line_and_never_a_failure() -> None:
    pytest_suite, vitest_suite = _full()
    text = render(pytest_suite, vitest_suite, None, ["sales -> stock", "shared -> rest"])
    assert "map is 2 edges behind" in text
    assert "sales -> stock" in text
    assert "map is" not in render(pytest_suite, vitest_suite, None, [])


def test_main_reports_the_edges_the_committed_map_lacks(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    derived = tmp_path / "derived.json"
    derived.write_text(json.dumps({"no_such_area": ["rest"]}))
    code = main(["--derived", str(derived), "--baseline", str(tmp_path / "none.md")])
    assert code == 0
    assert "map is 1 edges behind" in capsys.readouterr().out


def test_the_output_holds_only_paths_and_numbers() -> None:
    text = render(*_full(), None)
    assert "/home/" not in text and "@" not in text


# --- the pytest data of each group ---------------------------------------------------------


def _coverage_run(checkout: Path, data_dir: Path, snippet: str) -> None:
    """One real `coverage run` of `snippet` in a throw-away checkout, as pytest-cov writes it:
    parallel data files with paths relative to the checkout."""
    data_dir.mkdir(parents=True)
    script = checkout / "run_snippet.py"
    script.write_text(snippet + "\n")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("COV_CORE", "COVERAGE"))}
    subprocess.run(
        [
            sys.executable,
            "-m",
            "coverage",
            "run",
            f"--data-file={data_dir / '.coverage'}",
            str(script),
        ],
        cwd=checkout,
        env={**env, "PYTHONPATH": str(checkout)},
        check=True,
        capture_output=True,
    )


@pytest.fixture
def checkout(tmp_path: Path) -> Path:
    root = tmp_path / "checkout"
    (root / "app" / "sales").mkdir(parents=True)
    (root / "app" / "__init__.py").write_text("")
    (root / "app" / "sales" / "__init__.py").write_text("")
    (root / "app" / "sales" / "price.py").write_text(
        "def a() -> int:\n    return 1\n\n\ndef b() -> int:\n    return 2\n"
    )
    (root / "pyproject.toml").write_text(
        "[tool.coverage.run]\nrelative_files = true\nparallel = true\nsource = ['app']\n"
    )
    return root


def test_the_data_of_two_groups_is_combined_into_one_total(
    checkout: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    artifacts = tmp_path / "artifacts"
    _coverage_run(
        checkout,
        artifacts / coverage_artifact("sales"),
        "from app.sales.price import a; a()",
    )
    assert set(group_dirs(artifacts)) == {"sales"}
    _coverage_run(
        checkout,
        artifacts / coverage_artifact(ALWAYS_GROUP),
        "from app.sales.price import b; b()",
    )
    found = group_dirs(artifacts)
    assert set(found) == {"sales", ALWAYS_GROUP}
    monkeypatch.chdir(checkout)
    alone = read_pytest_json(combine_pytest([found["sales"]], checkout, tmp_path / "one"))
    both = read_pytest_json(combine_pytest(list(found.values()), checkout, tmp_path / "two"))
    assert both["sales"].total == alone["sales"].total
    assert both["sales"].covered > alone["sales"].covered


def test_a_group_that_left_no_data_did_not_run(tmp_path: Path) -> None:
    (tmp_path / coverage_artifact("sales")).mkdir()
    assert group_dirs(tmp_path) == {}
    assert group_dirs(tmp_path / "no-such-dir") == {}
