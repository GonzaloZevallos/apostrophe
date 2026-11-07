"""`scripts/ci_flaky.py` (GH-563): the flaky report of CI, at the seam of its CLI.

Each suite has three inline cases trimmed from a real run of the pinned versions (Playwright 1.63
`json` reporter, pytest 9.1 `--junitxml` with `-o junit_family=xunit1` and `--reruns 1`, vitest 5
`json` reporter with `retry: 1`): a test that passed, one that failed and then passed, and one
that failed twice. Only the second is flaky.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

from scripts import ci_flaky

SECRET = "SECRET typed by the test"
PREFIX = "agentic-flakes: "


def extract(
    tmp_path: Path, suite: str, raw: str, capsys: pytest.CaptureFixture[str]
) -> tuple[list[str], str]:
    """Run `extract <suite> <raw file> <out>` and give back the ids it wrote and what it printed."""
    source = tmp_path / "raw"
    source.write_text(raw, encoding="utf-8")
    out = tmp_path / "out.json"
    assert ci_flaky.main(["extract", suite, str(source), str(out)]) == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    return written["tests"], capsys.readouterr().out


def playwright_test(*statuses: str) -> dict[str, object]:
    return {
        "expectedStatus": "passed",
        "results": [
            {"status": status, "retry": retry, "error": {"message": SECRET}}
            for retry, status in enumerate(statuses)
        ],
    }


def playwright_report(*suites: dict[str, object]) -> str:
    return json.dumps({"suites": list(suites), "stats": {}})


def playwright_file(
    file: str,
    specs: list[tuple[str, tuple[str, ...]]],
    groups: dict[str, list[tuple[str, tuple[str, ...]]]] | None = None,
) -> dict[str, object]:
    def spec(title: str, statuses: tuple[str, ...]) -> dict[str, object]:
        return {"title": title, "file": file, "tests": [playwright_test(*statuses)]}

    return {
        "title": file,
        "file": file,
        "specs": [spec(*each) for each in specs],
        "suites": [
            {"title": group, "file": file, "specs": [spec(*each) for each in members]}
            for group, members in (groups or {}).items()
        ],
    }


def test_playwright_a_test_that_passed_is_not_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = playwright_report(playwright_file("flow.spec.ts", [("signs in", ("passed",))]))
    assert extract(tmp_path, "playwright", raw, capsys)[0] == []


def test_playwright_a_test_that_failed_then_passed_is_reported_by_id_only(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = playwright_report(playwright_file("flow.spec.ts", [("signs in", ("failed", "passed"))]))
    ids, printed = extract(tmp_path, "playwright", raw, capsys)
    assert ids == ["flow.spec.ts › signs in"]
    assert SECRET not in printed
    assert SECRET not in (tmp_path / "out.json").read_text(encoding="utf-8")


def test_playwright_a_test_that_failed_twice_is_not_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = playwright_report(
        playwright_file(
            "flow.spec.ts",
            [("signs in", ("failed", "failed")), ("times out", ("timedOut", "timedOut"))],
        )
    )
    assert extract(tmp_path, "playwright", raw, capsys)[0] == []


def test_playwright_a_timeout_then_a_pass_is_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = playwright_report(playwright_file("flow.spec.ts", [("slow", ("timedOut", "passed"))]))
    assert extract(tmp_path, "playwright", raw, capsys)[0] == ["flow.spec.ts › slow"]


def test_playwright_serial_group_reports_only_the_test_that_flaked(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A serial group reruns whole: the first test passes twice and the third was skipped and
    then passed; only the second failed and then passed."""
    raw = playwright_report(
        playwright_file(
            "navigation.spec.ts",
            [],
            {
                "group": [
                    ("first", ("passed", "passed")),
                    ("second", ("failed", "passed")),
                    ("third", ("skipped", "passed")),
                ]
            },
        )
    )
    assert extract(tmp_path, "playwright", raw, capsys)[0] == [
        "navigation.spec.ts › group › second"
    ]


def pytest_report(*cases: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?><testsuites name="pytest tests">'
        f'<testsuite name="pytest" tests="{len(cases)}">{"".join(cases)}</testsuite></testsuites>'
    )


def pytest_case(name: str, failed: bool = False, classname: str = "tests.test_a.TestK") -> str:
    body = f'<failure message="AssertionError: {SECRET}">{SECRET}</failure>' if failed else ""
    return (
        f'<testcase classname="{classname}" name="{name}" file="tests/test_a.py" line="3" '
        f'time="0.0">{body}</testcase>'
    )


def test_pytest_a_test_that_passed_is_not_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = pytest_report(pytest_case("test_ok"))
    assert extract(tmp_path, "pytest", raw, capsys)[0] == []


def test_pytest_a_test_that_failed_then_passed_is_reported_by_node_id_only(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """pytest-rerunfailures writes the failed attempt as a bare testcase and the final one after."""
    raw = pytest_report(
        pytest_case("test_ok"),
        pytest_case("test_flaky"),
        pytest_case("test_flaky"),
        pytest_case("test_param[1]"),
    )
    ids, printed = extract(tmp_path, "pytest", raw, capsys)
    assert ids == ["tests/test_a.py::TestK::test_flaky"]
    assert SECRET not in printed


def test_pytest_a_test_that_failed_twice_is_not_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = pytest_report(pytest_case("test_twice"), pytest_case("test_twice", failed=True))
    assert extract(tmp_path, "pytest", raw, capsys)[0] == []


def test_pytest_a_module_level_test_has_no_class_in_its_node_id(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    raw = pytest_report(
        pytest_case("test_top", classname="tests.test_a"),
        pytest_case("test_top", classname="tests.test_a"),
    )
    assert extract(tmp_path, "pytest", raw, capsys)[0] == ["tests/test_a.py::test_top"]


def vitest_test(
    title: str, status: str, failures: int, ancestors: tuple[str, ...] = ()
) -> dict[str, object]:
    return {
        "ancestorTitles": list(ancestors),
        "title": title,
        "status": status,
        "failureMessages": [f"Error: {SECRET}\n    at somewhere"] * failures,
    }


def vitest_report(root: Path, *tests: dict[str, object]) -> str:
    return json.dumps(
        {
            "testResults": [
                {"name": str(root / "web/src/a.test.ts"), "assertionResults": list(tests)}
            ]
        }
    )


def test_vitest_a_test_that_passed_is_not_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    raw = vitest_report(tmp_path, vitest_test("passes", "passed", 0))
    assert extract(tmp_path, "vitest", raw, capsys)[0] == []


def test_vitest_a_test_that_failed_then_passed_is_reported_by_id_only(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    raw = vitest_report(
        tmp_path,
        vitest_test("passes", "passed", 0),
        vitest_test("flaky once", "passed", 1, ("suite",)),
    )
    ids, printed = extract(tmp_path, "vitest", raw, capsys)
    assert ids == ["web/src/a.test.ts › suite › flaky once"]
    assert SECRET not in printed


def test_vitest_a_test_that_failed_twice_is_not_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    raw = vitest_report(tmp_path, vitest_test("fails twice", "failed", 2, ("suite",)))
    assert extract(tmp_path, "vitest", raw, capsys)[0] == []


@pytest.mark.parametrize("suite", ["playwright", "pytest", "vitest"])
def test_a_missing_input_is_no_flaky_tests_and_exit_zero(
    suite: str, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    out = tmp_path / "out.json"
    assert ci_flaky.main(["extract", suite, str(tmp_path / "absent"), str(out)]) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["tests"] == []
    assert capsys.readouterr().out == ""


@pytest.mark.parametrize("suite", ["playwright", "pytest", "vitest"])
def test_an_unreadable_input_is_no_flaky_tests_and_exit_zero(
    suite: str, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert extract(tmp_path, suite, "{ not json and not xml", capsys)[0] == []


def test_an_unknown_suite_or_wrong_arguments_still_exit_zero(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert ci_flaky.main(["extract", "jest", str(tmp_path), str(tmp_path / "o.json")]) == 0
    assert ci_flaky.main(["extract"]) == 0
    assert ci_flaky.main([]) == 0
    assert ci_flaky.main(["report"]) == 0
    assert not (tmp_path / "o.json").exists()
    assert capsys.readouterr().out == ""


def write_normalised(directory: Path, name: str, check: str, tests: list[str]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / name).write_text(
        json.dumps({"v": 1, "check": check, "tests": tests}), encoding="utf-8"
    )


def test_report_prints_one_block_line_per_check_in_the_format_of_the_stack(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """agentic-system #464 (ADR-0085): `agentic-flakes: {"v":1,"check":"<name>","tests":[...]}`,
    with the stack's check names, shards of one suite added up and no id twice."""
    write_normalised(tmp_path / "flaky-pytest-1", "a.json", "tests", ["tests/a.py::test_x"])
    write_normalised(
        tmp_path / "flaky-pytest-2", "b.json", "tests", ["tests/b.py::test_y", "tests/a.py::test_x"]
    )
    write_normalised(tmp_path / "flaky-playwright-1", "c.json", "web-e2e", ["flow.spec.ts › a"])
    write_normalised(tmp_path / "flaky-vitest", "d.json", "web-tests", [])
    assert ci_flaky.main(["report", str(tmp_path)]) == 0
    lines = capsys.readouterr().out.splitlines()
    assert lines == [
        PREFIX + '{"v":1,"check":"tests","tests":["tests/a.py::test_x","tests/b.py::test_y"]}',
        PREFIX + '{"v":1,"check":"web-e2e","tests":["flow.spec.ts › a"]}',
    ]


def test_report_with_nothing_flaky_prints_nothing_and_skips_unreadable_files(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "broken.json").write_text("{ nope", encoding="utf-8")
    (tmp_path / "list.json").write_text("[1, 2]", encoding="utf-8")
    write_normalised(tmp_path, "empty.json", "tests", [])
    assert ci_flaky.main(["report", str(tmp_path)]) == 0
    assert capsys.readouterr().out == ""
    assert ci_flaky.main(["report", str(tmp_path / "absent")]) == 0
    assert capsys.readouterr().out == ""


def test_report_bounds_an_id_to_the_length_the_reader_accepts(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write_normalised(tmp_path, "long.json", "tests", ["tests/a.py::" + "x" * 500])
    ci_flaky.main(["report", str(tmp_path)])
    block = json.loads(capsys.readouterr().out.removeprefix(PREFIX))
    assert [len(each) for each in block["tests"]] == [ci_flaky.ID_MAX_CHARS]


def test_the_cli_runs_as_a_module_the_way_ci_yml_calls_it(tmp_path: Path) -> None:
    raw = tmp_path / "pytest.xml"
    raw.write_text(pytest_report(pytest_case("test_f"), pytest_case("test_f")), encoding="utf-8")
    out = tmp_path / "flaky" / "flaky-pytest-1.json"
    repo = Path(__file__).resolve().parent.parent
    extracted = subprocess.run(
        [sys.executable, "-m", "scripts.ci_flaky", "extract", "pytest", str(raw), str(out)],
        cwd=repo,
        capture_output=True,
        text=True,
        check=False,
    )
    assert extracted.returncode == 0
    reported = subprocess.run(
        [sys.executable, "-m", "scripts.ci_flaky", "report", str(tmp_path / "flaky")],
        cwd=repo,
        capture_output=True,
        text=True,
        check=False,
    )
    assert reported.returncode == 0
    assert reported.stdout == (
        PREFIX + '{"v":1,"check":"tests","tests":["tests/test_a.py::TestK::test_f"]}\n'
    )


WORKFLOW = Path(__file__).resolve().parent.parent / ".github" / "workflows" / "ci.yml"


def test_every_ci_yml_call_matches_the_cli_and_never_changes_a_job_result() -> None:
    """The `extract` and `report` steps of ci.yml are invocations of this module's CLI, each run
    under `always()` and unable to fail its job; no other step parses a suite's result."""
    jobs = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]
    calls: dict[str, list[list[str]]] = {}
    for job, body in jobs.items():
        for step in body["steps"]:
            run = str(step.get("run", ""))
            if "scripts.ci_flaky" in run:
                words = re.sub(r"\$\{\{[^}]*\}\}", "X", run.split("scripts.ci_flaky ")[1])
                calls.setdefault(job, []).append(words.split())
                assert step.get("if") == "always()", run
                assert step.get("continue-on-error") is True, run
            else:
                assert "ci_flaky" not in run and "results.json" not in run, run
    assert sorted(calls) == ["ci-ok", "e2e-shard", "pytest", "vitest"]
    assert [call[:2] for call in calls["pytest"] + calls["vitest"] + calls["e2e-shard"]] == [
        ["extract", "pytest"],
        ["extract", "vitest"],
        ["extract", "playwright"],
    ]
    assert all(len(call) == 4 for call in calls["pytest"] + calls["vitest"] + calls["e2e-shard"])
    assert calls["ci-ok"] == [["report", "flaky-data"]]
