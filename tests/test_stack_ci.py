"""Local checks and CI run one list (ADR-0054): every `checks` command of
`.agentic/stack.yaml` is a `run:` step of exactly one job of `.github/workflows/ci.yml`,
and every `run:` step of that file is a `setup` command, a `checks` command or a named
`CI_ONLY` or `PARKED` entry, and every `CI_ONLY` and `PARKED` entry is run by some job, and
no command is in both dicts. A `PARKED` command runs in CI on every pull request and gates
nothing; the mechanism stays, and the dict is empty since e2e became `CI_ONLY` (GH-533). When
`stack.yaml` has `ci:`, the gated jobs are the job ids of `ci.yml` and together hold every check,
every job that runs a `CI_ONLY` command is gated, and no gated job holds a `PARKED` command.
`stack_ci_problems` is a pure function over the parsed YAML, so the rejections are tested on
in-memory data; the real files are checked with `ci:` as declared, absent, and narrowed."""

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
    "uv run --no-project python -m scripts.docs.generate": (
        "the docs generator, until `docs:` is declared"
    ),
    (
        'git diff --exit-code -- docs/architecture/generated docs/api && test -z "$(git status '
        '--porcelain --untracked-files=all -- docs/architecture/generated docs/api)"'
    ): "the CI form of the reserved `docs` check",
    "bash scripts/docs/install-ci-tools.sh": "binaries on no package manager the repo uses",
    "bash scripts/docs/ci-mermaid-render.sh": "needs Chromium",
    "lychee --offline --no-progress docs/architecture docs/api/README.md": (
        "binary installed only in CI"
    ),
    "uv run --no-project python -m scripts.docs.api_breaks": "needs the base ref and the PR body",
    "npm --prefix web run e2e": (
        "runs only in CI: local web-e2e is off by the owner (2026-10-26, PR #434); "
        "gates every merge (GH-533)"
    ),
}

# Commands CI runs on every pull request that gate no merge, each with the reason it is parked
# and when it joins `ci:`. A parked command never sits in a gated job. Empty since GH-533.
PARKED: dict[str, str] = {}

Data = dict[str, Any]


def _load(path: Path) -> Data:
    return cast("Data", yaml.safe_load(path.read_text()))


STACK = _load(REPO_ROOT / ".agentic" / "stack.yaml")
WORKFLOW = _load(REPO_ROOT / ".github" / "workflows" / "ci.yml")
GATED = ["test", "web", "docs", "e2e"]


def _runs(workflow: Data) -> dict[str, list[str]]:
    """The `run:` commands of each job, in order."""
    return {
        job_id: [cast("str", step["run"]).strip() for step in job["steps"] if "run" in step]
        for job_id, job in workflow["jobs"].items()
    }


def stack_ci_problems(
    stack: Data, workflow: Data, ci_only: dict[str, str], parked: dict[str, str]
) -> list[str]:
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

    for kind, exempt in (("CI_ONLY", ci_only), ("PARKED", parked)):
        for command in exempt:
            if not any(command in commands for commands in runs.values()):
                problems.append(f"{kind} command ({command}) is run by no job of ci.yml")

    problems.extend(
        f"command ({command}) is in both CI_ONLY and PARKED"
        for command in ci_only
        if command in parked
    )

    if gated is not None:
        for name in gated:
            if name not in runs:
                problems.append(f"ci: names {name!r}, which is not a job of ci.yml")
        for command in ci_only:
            problems.extend(
                f"CI_ONLY command ({command}) runs in job {job!r}, which is not in ci:"
                for job, commands in runs.items()
                if command in commands and job not in gated
            )
        for command in parked:
            problems.extend(
                f"PARKED command ({command}) is in gated job {job!r}"
                for job, commands in runs.items()
                if command in commands and job in gated
            )

    known = {*setup.values(), *checks.values(), *ci_only, *parked}
    for job, commands in runs.items():
        problems.extend(
            f"job {job!r} runs an unknown step: {command}"
            for command in commands
            if command not in known
        )
    return problems


def _with_ci(stack: Data, gated: list[str]) -> Data:
    return {**copy.deepcopy(stack), "ci": gated}


def _without_ci(stack: Data) -> Data:
    return {key: copy.deepcopy(value) for key, value in stack.items() if key != "ci"}


def _renamed(workflow: Data, old: str, new: str) -> Data:
    jobs = {(new if job == old else job): body for job, body in workflow["jobs"].items()}
    return {**copy.deepcopy(workflow), "jobs": copy.deepcopy(jobs)}


def test_ci_yml_runs_the_declared_checks_and_nothing_unnamed() -> None:
    assert stack_ci_problems(STACK, WORKFLOW, CI_ONLY, PARKED) == []


def test_the_same_holds_once_ci_is_turned_on() -> None:
    assert stack_ci_problems(_with_ci(STACK, GATED), WORKFLOW, CI_ONLY, PARKED) == []


def test_a_renamed_job_is_not_a_job_the_gate_names() -> None:
    problems = stack_ci_problems(
        _with_ci(STACK, GATED), _renamed(WORKFLOW, "test", "unit"), CI_ONLY, PARKED
    )
    assert any("ci: names 'test'" in p for p in problems)
    assert any("job 'unit', not in ci:" in p for p in problems)


def test_a_check_in_an_ungated_job_is_refused_when_ci_is_on() -> None:
    problems = stack_ci_problems(_with_ci(STACK, ["test", "e2e"]), WORKFLOW, CI_ONLY, PARKED)
    assert any("'web'" in p and "not in ci:" in p for p in problems)


def test_the_real_files_gate_exactly_the_four_jobs_and_agree() -> None:
    assert STACK["ci"] == GATED
    assert stack_ci_problems(STACK, WORKFLOW, CI_ONLY, PARKED) == []


def test_e2e_is_a_ci_only_command_and_nothing_is_parked() -> None:
    assert "npm --prefix web run e2e" in CI_ONLY
    assert PARKED == {}


def test_the_e2e_job_out_of_ci_is_refused() -> None:
    problems = stack_ci_problems(
        _with_ci(STACK, ["test", "web", "docs"]), WORKFLOW, CI_ONLY, PARKED
    )
    assert (
        "CI_ONLY command (npm --prefix web run e2e) runs in job 'e2e', which is not in ci:"
        in problems
    )


def _tiny() -> tuple[Data, Data]:
    """A stack with one check and a workflow of two jobs, the second running `make slow`."""
    stack: Data = {"setup": {}, "checks": {"unit": "make unit"}, "ci": ["test"]}
    workflow: Data = {
        "jobs": {
            "test": {"steps": [{"run": "make unit"}]},
            "other": {"steps": [{"run": "make slow"}]},
        }
    }
    return stack, workflow


def test_a_ci_only_command_in_an_ungated_job_is_refused_when_ci_is_on() -> None:
    stack, workflow = _tiny()
    problems = stack_ci_problems(stack, workflow, {"make slow": "slow"}, {})
    assert problems == ["CI_ONLY command (make slow) runs in job 'other', which is not in ci:"]


def test_a_ci_only_command_in_a_gated_job_and_an_ungated_one_is_refused_once() -> None:
    stack, workflow = _tiny()
    workflow["jobs"]["test"]["steps"].append({"run": "make slow"})
    problems = stack_ci_problems(stack, workflow, {"make slow": "slow"}, {})
    assert problems == ["CI_ONLY command (make slow) runs in job 'other', which is not in ci:"]


def test_a_ci_only_command_in_every_holder_gated_is_accepted() -> None:
    stack, workflow = _tiny()
    stack["ci"] = ["test", "other"]
    assert stack_ci_problems(stack, workflow, {"make slow": "slow"}, {}) == []


def test_a_parked_command_in_a_gated_job_is_refused() -> None:
    stack, workflow = _tiny()
    stack["ci"] = ["test", "other"]
    problems = stack_ci_problems(stack, workflow, {}, {"make slow": "parked"})
    assert problems == ["PARKED command (make slow) is in gated job 'other'"]


def test_a_parked_command_in_an_ungated_job_is_accepted() -> None:
    stack, workflow = _tiny()
    assert stack_ci_problems(stack, workflow, {}, {"make slow": "parked"}) == []


def test_a_parked_command_no_job_runs_is_refused() -> None:
    stack, workflow = _tiny()
    stack["ci"] = ["test", "other"]
    problems = stack_ci_problems(stack, workflow, {"make slow": "slow"}, {"make ghost": "nobody"})
    assert problems == ["PARKED command (make ghost) is run by no job of ci.yml"]


def test_a_command_in_both_dicts_is_refused() -> None:
    stack, workflow = _tiny()
    del stack["ci"]
    problems = stack_ci_problems(stack, workflow, {"make slow": "a"}, {"make slow": "b"})
    assert problems == ["command (make slow) is in both CI_ONLY and PARKED"]


def test_a_ci_only_entry_no_job_runs_is_refused() -> None:
    ci_only = {**CI_ONLY, "npm --prefix web run storybook": "a step nobody runs"}
    problems = stack_ci_problems(STACK, WORKFLOW, ci_only, PARKED)
    assert problems == [
        "CI_ONLY command (npm --prefix web run storybook) is run by no job of ci.yml"
    ]


def test_an_unknown_step_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["test"]["steps"].append({"run": "make everything-green"})
    problems = stack_ci_problems(STACK, workflow, CI_ONLY, PARKED)
    assert problems == ["job 'test' runs an unknown step: make everything-green"]


def test_a_check_missing_from_ci_yml_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["web-docs"] = "npm --prefix web run docs"
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY, PARKED)
    assert any("'web-docs'" in p and "0 jobs" in p for p in problems)


def test_a_check_run_by_two_jobs_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["e2e"]["steps"].append({"run": STACK["checks"]["types"]})
    problems = stack_ci_problems(STACK, workflow, CI_ONLY, PARKED)
    assert any("'types'" in p and "2 jobs" in p for p in problems)


def test_a_check_that_differs_from_its_ci_step_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["types"] = "uv run --no-project mypy app tests"
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY, PARKED)
    assert any("'types'" in p for p in problems)
    assert any("mypy app tests scripts" in p and "unknown step" in p for p in problems)


@pytest.mark.parametrize("command", sorted(CI_ONLY))
def test_every_ci_only_entry_has_a_reason(command: str) -> None:
    assert CI_ONLY[command].strip()


def test_every_parked_entry_has_a_reason() -> None:
    for command, reason in PARKED.items():
        assert reason.strip(), command
