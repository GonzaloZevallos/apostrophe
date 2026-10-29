"""`scripts/ci_verdict.py`: the decision behind the `ci-ok` job. The verdict is a pure function
over GitHub's `needs` JSON, so every case is in-memory data; `main` is tested through files."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts import ci_verdict
from scripts.ci_verdict import PARKED_SUITES, SUITES, verdict
from tests.test_stack_ci import PARKED

FLAGS = {"pytest": "true", "vitest": "true", "e2e": "true"}


def needs(
    *,
    changes: str = "success",
    flags: dict[str, str] | None = None,
    pytest: str = "success",
    vitest: str = "success",
    e2e: str = "success",
    checks: str = "success",
    web: str = "success",
    coverage: str = "success",
) -> dict[str, object]:
    """A `needs` object with every job passing unless a keyword says otherwise."""
    outputs = FLAGS if flags is None else flags
    return {
        "changes": {"result": changes, "outputs": outputs},
        "pytest": {"result": pytest, "outputs": {}},
        "vitest": {"result": vitest, "outputs": {}},
        "e2e": {"result": e2e, "outputs": {}},
        "checks": {"result": checks, "outputs": {}},
        "web": {"result": web, "outputs": {}},
        "coverage": {"result": coverage, "outputs": {}},
    }


def test_everything_succeeding_passes_with_one_line_per_job() -> None:
    ok, lines = verdict(needs())
    assert ok
    assert len(lines) == 7
    assert not any("warning" in line for line in lines)


def test_a_failed_gating_suite_fails_and_is_named() -> None:
    ok, lines = verdict(needs(pytest="failure"))
    assert not ok
    assert "pytest: failure" in " ".join(lines)


def test_a_cancelled_gating_suite_fails() -> None:
    ok, lines = verdict(needs(vitest="cancelled"))
    assert not ok
    assert "vitest: cancelled" in " ".join(lines)


def test_a_skipped_suite_with_a_false_flag_passes() -> None:
    flags = {"pytest": "false", "vitest": "true", "e2e": "true"}
    ok, lines = verdict(needs(pytest="skipped", flags=flags))
    assert ok
    assert "pytest: skipped" in " ".join(lines)


def test_a_skipped_suite_with_a_true_flag_fails_naming_the_suite() -> None:
    ok, lines = verdict(needs(vitest="skipped"))
    assert not ok
    assert "vitest: skipped but its flag is 'true'" in lines


def test_a_skipped_suite_with_a_missing_flag_fails_naming_the_suite() -> None:
    flags = {"pytest": "true", "e2e": "true"}
    ok, lines = verdict(needs(vitest="skipped", flags=flags))
    assert not ok
    assert "vitest: skipped but its flag is missing" in lines


def test_a_failed_changes_job_fails_before_any_flag_is_read() -> None:
    flags = {"pytest": "false", "vitest": "false", "e2e": "false"}
    ok, lines = verdict(needs(changes="failure", pytest="skipped", flags=flags))
    assert not ok
    assert lines == ["changes: failure"]


def test_a_skipped_changes_job_fails() -> None:
    ok, lines = verdict(needs(changes="skipped"))
    assert not ok
    assert lines == ["changes: skipped"]


@pytest.mark.parametrize("job", ["checks", "web"])
@pytest.mark.parametrize("result", ["failure", "cancelled", "skipped"])
def test_an_always_job_that_is_not_success_fails(job: str, result: str) -> None:
    given = needs()
    given[job] = {"result": result, "outputs": {}}
    ok, lines = verdict(given)
    assert not ok
    assert f"{job}: {result}" in lines


def test_coverage_failed_with_everything_else_passing_is_a_pass_and_a_warning() -> None:
    ok, lines = verdict(needs(coverage="failure"))
    assert ok
    assert "coverage: failure (warning)" in lines


def test_coverage_skipped_is_a_pass_and_a_warning() -> None:
    ok, lines = verdict(needs(coverage="skipped"))
    assert ok
    assert "coverage: skipped (warning)" in lines


def test_coverage_cancelled_fails() -> None:
    ok, lines = verdict(needs(coverage="cancelled"))
    assert not ok
    assert "coverage: cancelled" in lines


def test_a_failed_parked_e2e_is_a_pass_and_a_warning() -> None:
    ok, lines = verdict(needs(e2e="failure"))
    assert ok
    assert "e2e: failure (warning)" in lines


def test_a_parked_e2e_skipped_with_a_false_flag_passes_silently() -> None:
    flags = {"pytest": "true", "vitest": "true", "e2e": "false"}
    ok, lines = verdict(needs(e2e="skipped", flags=flags))
    assert ok
    assert not any("warning" in line for line in lines)


def test_a_parked_e2e_skipped_with_a_true_flag_is_a_warning_not_a_failure() -> None:
    ok, lines = verdict(needs(e2e="skipped"))
    assert ok
    assert "e2e: skipped (warning)" in lines


def test_a_cancelled_parked_e2e_fails() -> None:
    ok, lines = verdict(needs(e2e="cancelled"))
    assert not ok
    assert "e2e: cancelled" in lines


def test_a_job_in_no_map_fails_by_name() -> None:
    given = needs()
    given["deploy-preview"] = {"result": "success", "outputs": {}}
    ok, lines = verdict(given)
    assert not ok
    assert "deploy-preview: unknown job" in lines


def test_a_missing_gating_suite_fails_by_name() -> None:
    given = needs()
    del given["web"]
    ok, lines = verdict(given)
    assert not ok
    assert "web: missing" in lines


def test_a_malformed_job_entry_fails_by_name() -> None:
    given = needs()
    given["pytest"] = "success"
    ok, lines = verdict(given)
    assert not ok
    assert "pytest: no result" in lines


def test_the_suites_map_each_job_to_its_changes_flag() -> None:
    assert SUITES == {"pytest": "pytest", "vitest": "vitest"}


def test_e2e_is_parked_exactly_when_the_stack_ci_test_parks_its_command() -> None:
    assert ("e2e" in PARKED_SUITES) == ("npm --prefix web run e2e" in PARKED)


def test_main_exits_zero_on_a_pass_and_prints_only_names_and_results(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = tmp_path / "needs.json"
    path.write_text(json.dumps(needs(coverage="failure")))
    assert ci_verdict.main([str(path)]) == 0
    out = capsys.readouterr().out
    assert "coverage: failure (warning)" in out
    assert "changes: success" in out


def test_main_exits_one_on_a_failure(tmp_path: Path) -> None:
    path = tmp_path / "needs.json"
    path.write_text(json.dumps(needs(web="failure")))
    assert ci_verdict.main([str(path)]) == 1


def test_main_reads_stdin_without_a_file_argument(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    import io

    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(needs(pytest="failure"))))
    assert ci_verdict.main([]) == 1
    assert "pytest: failure" in capsys.readouterr().out


def test_main_fails_on_input_that_is_not_a_json_object(tmp_path: Path) -> None:
    path = tmp_path / "needs.json"
    path.write_text("[1, 2]")
    assert ci_verdict.main([str(path)]) == 1
