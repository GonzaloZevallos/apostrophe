"""Local checks and CI run one list (ADR-0054): every `checks` command of
`.agentic/stack.yaml` is a `run:` step of exactly one job of `.github/workflows/ci.yml`,
and every `run:` step of that file is a `setup` command, a `checks` command or a named
`CI_ONLY` entry, and every `CI_ONLY` entry is run by some job. When `stack.yaml` has `ci:`, the gated jobs are the job ids of `ci.yml`
and together hold every check and every `CI_ONLY` command. `stack_ci_problems` is a pure
function over the parsed YAML, so the rejections are tested on in-memory data; the real
files are checked with `ci:` absent (today) and with it added to a copy."""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, cast

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]

# Commands that only CI runs, each with the reason it is not a local check.
CI_ONLY: dict[str, str] = {
    "npx --prefix web playwright install --with-deps chromium": (
        "the runner needs the root `--with-deps` form of `setup.web-browsers`"
    ),
    "npm --prefix web run e2e": "off locally by the owner's decision of 2026-10-26",
}

Data = dict[str, Any]


def _load(path: Path) -> Data:
    return cast("Data", yaml.safe_load(path.read_text()))


STACK = _load(REPO_ROOT / ".agentic" / "stack.yaml")
WORKFLOW = _load(REPO_ROOT / ".github" / "workflows" / "ci.yml")
GATED = ["test", "web", "e2e"]


def _runs(workflow: Data) -> dict[str, list[str]]:
    """The `run:` commands of each job, in order."""
    return {
        job_id: [cast("str", step["run"]).strip() for step in job["steps"] if "run" in step]
        for job_id, job in workflow["jobs"].items()
    }


def stack_ci_problems(stack: Data, workflow: Data, ci_only: dict[str, str]) -> list[str]:
    """What keeps `stack` and `workflow` from being one list of checks."""
    problems: list[str] = []
    runs = _runs(workflow)
    checks: dict[str, str] = stack["checks"]
    setup: dict[str, str] = stack["setup"]
    gated: list[str] | None = stack.get("ci")

    for name, command in checks.items():
        holders = [job for job, commands in runs.items() if command in commands]
        if len(holders) != 1:
            problems.append(f"check {name!r} ({command}) is a step of {len(holders)} jobs, not 1")
        elif gated is not None and holders[0] not in gated:
            problems.append(f"check {name!r} runs in job {holders[0]!r}, not in ci:")

    for command in ci_only:
        if not any(command in commands for commands in runs.values()):
            problems.append(f"CI_ONLY command ({command}) is run by no job of ci.yml")

    if gated is not None:
        for name in gated:
            if name not in runs:
                problems.append(f"ci: names {name!r}, which is not a job of ci.yml")
        for command in ci_only:
            holders = [job for job, commands in runs.items() if command in commands]
            if holders and not any(job in gated for job in holders):
                problems.append(f"CI_ONLY command ({command}) is not in a gated job")

    known = {*setup.values(), *checks.values(), *ci_only}
    for job, commands in runs.items():
        problems.extend(
            f"job {job!r} runs an unknown step: {command}"
            for command in commands
            if command not in known
        )
    return problems


def _with_ci(stack: Data, gated: list[str]) -> Data:
    return {**copy.deepcopy(stack), "ci": gated}


def _renamed(workflow: Data, old: str, new: str) -> Data:
    jobs = {(new if job == old else job): body for job, body in workflow["jobs"].items()}
    return {**copy.deepcopy(workflow), "jobs": copy.deepcopy(jobs)}


def test_ci_yml_runs_the_declared_checks_and_nothing_unnamed() -> None:
    assert stack_ci_problems(STACK, WORKFLOW, CI_ONLY) == []


def test_the_same_holds_once_ci_is_turned_on() -> None:
    assert stack_ci_problems(_with_ci(STACK, GATED), WORKFLOW, CI_ONLY) == []


def test_a_renamed_job_is_not_a_job_the_gate_names() -> None:
    problems = stack_ci_problems(
        _with_ci(STACK, GATED), _renamed(WORKFLOW, "test", "unit"), CI_ONLY
    )
    assert any("ci: names 'test'" in p for p in problems)
    assert any("job 'unit', not in ci:" in p for p in problems)


def test_a_check_in_an_ungated_job_is_refused_when_ci_is_on() -> None:
    problems = stack_ci_problems(_with_ci(STACK, ["test", "e2e"]), WORKFLOW, CI_ONLY)
    assert any("'web'" in p and "not in ci:" in p for p in problems)


def test_a_ci_only_command_in_an_ungated_job_is_refused_when_ci_is_on() -> None:
    problems = stack_ci_problems(_with_ci(STACK, ["test", "web"]), WORKFLOW, CI_ONLY)
    assert any("npm --prefix web run e2e" in p and "gated" in p for p in problems)


def test_a_ci_only_entry_no_job_runs_is_refused() -> None:
    ci_only = {**CI_ONLY, "npm --prefix web run storybook": "a step nobody runs"}
    problems = stack_ci_problems(STACK, WORKFLOW, ci_only)
    assert problems == [
        "CI_ONLY command (npm --prefix web run storybook) is run by no job of ci.yml"
    ]


def test_an_unknown_step_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["test"]["steps"].append({"run": "make everything-green"})
    problems = stack_ci_problems(STACK, workflow, CI_ONLY)
    assert problems == ["job 'test' runs an unknown step: make everything-green"]


def test_a_check_missing_from_ci_yml_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["web-docs"] = "npm --prefix web run docs"
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY)
    assert any("'web-docs'" in p and "0 jobs" in p for p in problems)


def test_a_check_run_by_two_jobs_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["e2e"]["steps"].append({"run": STACK["checks"]["types"]})
    problems = stack_ci_problems(STACK, workflow, CI_ONLY)
    assert any("'types'" in p and "2 jobs" in p for p in problems)


def test_a_check_that_differs_from_its_ci_step_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["types"] = "uv run --no-project mypy app tests"
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY)
    assert any("'types'" in p for p in problems)
    assert any("mypy app tests scripts" in p and "unknown step" in p for p in problems)


@pytest.mark.parametrize("command", sorted(CI_ONLY))
def test_every_ci_only_entry_has_a_reason(command: str) -> None:
    assert CI_ONLY[command].strip()
