"""Local checks and CI run one list (ADR-0054, ADR-0055): every `checks` command of
`.agentic/stack.yaml` is a `run:` step of exactly one job of `.github/workflows/ci.yml`, or,
for the three checks CI splits, the step its `SPLIT` template makes of it; every `run:` step of
that file is a `setup` command, a check, a `SPLIT` step, the verdict or a named `CI_ONLY`
entry; and every `CI_ONLY` entry is run by some job. When `stack.yaml` has `ci:`, the gated
job is the aggregator (`ci-ok`): it needs every other job, runs with `if: always()` and its only
step is the verdict script, so the jobs it needs hold every check and every `CI_ONLY` command.
The shape of the workflow is pinned too: no matrix is written as a literal, the e2e shards need
only `changes` and `build`, only the coverage job may write to a pull request, and the coverage
uploads carry the names `scripts/ci_changes.coverage_artifact` gives.
`stack_ci_problems` and `workflow_problems` are pure functions over the parsed YAML, so the
rejections are tested on in-memory data; the real files are checked with `ci:` absent and
present, and `actionlint` runs over the real workflow."""

from __future__ import annotations

import copy
import subprocess
import sys
from pathlib import Path
from typing import Any, cast

import pytest
import yaml

from scripts.ci_changes import coverage_artifact

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "ci.yml"

# Commands that only CI runs, each with the reason it is not a local check.
CI_ONLY: dict[str, str] = {
    "npx --prefix web playwright install --with-deps chromium": (
        "the runner needs the root `--with-deps` form of `setup.web-browsers`"
    ),
    "uv run --no-project python scripts/ci_changes.py": (
        "reads the merge ref's diff and writes the job outputs; there is no merge ref locally"
    ),
    (
        "uv run --no-project python -m scripts.ci_coverage --artifacts coverage-artifacts"
        " --vitest coverage-artifacts/coverage-vitest/coverage-summary.json"
        ' --scratch "$RUNNER_TEMP/combined" --derived "$RUNNER_TEMP/pytest_areas.json"'
        " > coverage.md"
    ): "renders the artifacts of the jobs that ran; only a CI run has them",
    (
        'uv run --no-project python scripts/ci_changes.py derive "$RUNNER_TEMP/combined/.coverage"'
        ' "$RUNNER_TEMP/pytest_areas.json"'
    ): "derives the area map from the master run's test contexts and warns on lag",
    'cat coverage.md >> "$GITHUB_STEP_SUMMARY"': "the job summary exists only on the runner",
}

# Checks CI runs split: check name -> (job, step template). `{check}` stands for the declared
# command, verbatim, so a change to the command reaches the step. The pytest group's arguments
# and the e2e specs reach the command through `xargs`, never through an unquoted expansion.
SPLIT: dict[str, tuple[str, str]] = {
    "tests": (
        "pytest",
        'uv run --no-project python scripts/ci_changes.py args "$GROUP" | xargs {check}',
    ),
    "web-tests": ("web", "{check} -- --coverage"),
    "web-e2e": ("e2e", 'echo "$SPECS" | xargs {check} -- --shard "$SHARD"'),
}

# The aggregating job: it needs every other job and its only step is this command.
AGGREGATOR = "ci-ok"
VERDICT = 'python3 scripts/ci_verdict.py "$NEEDS"'

# The only job that may hold a write permission, and which.
WRITERS: dict[str, set[str]] = {"coverage": {"pull-requests"}}

# The checks that are lint, types or unit tests: no job an e2e shard needs may run one.
BEFORE_E2E_FORBIDDEN = {
    "tests",
    "tests-fast",
    "ci-lint",
    "lint",
    "types",
    "web-types",
    "web-lint",
    "web-tests",
}

Data = dict[str, Any]


def _load(path: Path) -> Data:
    return cast("Data", yaml.safe_load(path.read_text()))


STACK = _load(REPO_ROOT / ".agentic" / "stack.yaml")
WORKFLOW = _load(WORKFLOW_PATH)
GATED = [AGGREGATOR]


def _runs(workflow: Data) -> dict[str, list[str]]:
    """The `run:` commands of each job, in order."""
    return {
        job_id: [cast("str", step["run"]).strip() for step in job["steps"] if "run" in step]
        for job_id, job in workflow["jobs"].items()
    }


def _needs(job: Data) -> list[str]:
    needs = job.get("needs", [])
    return [needs] if isinstance(needs, str) else list(needs)


def _expanded(split: dict[str, tuple[str, str]], checks: dict[str, str]) -> dict[str, str]:
    """check name -> the step its template makes of the declared command."""
    return {
        name: template.replace("{check}", checks[name])
        for name, (_, template) in split.items()
        if name in checks
    }


def stack_ci_problems(
    stack: Data,
    workflow: Data,
    ci_only: dict[str, str],
    split: dict[str, tuple[str, str]],
) -> list[str]:
    """What keeps `stack` and `workflow` from being one list of checks."""
    problems: list[str] = []
    runs = _runs(workflow)
    checks: dict[str, str] = stack["checks"]
    setup: dict[str, str] = stack["setup"]
    gated: list[str] | None = stack.get("ci")
    expanded = _expanded(split, checks)
    covered: set[str] = set()
    for name in gated or []:
        if name in workflow["jobs"]:
            covered |= {name, *_needs(workflow["jobs"][name])}

    for name, command in checks.items():
        if name in split:
            job, _ = split[name]
            step = expanded[name]
            holders = [j for j, commands in runs.items() if step in commands]
            if holders != [job]:
                problems.append(f"check {name!r} must be the step ({step}) of job {job!r} only")
        else:
            holders = [j for j, commands in runs.items() if command in commands]
            if len(holders) != 1:
                problems.append(
                    f"check {name!r} ({command}) is a step of {len(holders)} jobs, not 1"
                )
        if gated is not None and holders and holders[0] not in covered:
            problems.append(f"check {name!r} runs in job {holders[0]!r}, which ci: does not cover")
    for name in split:
        if name not in checks:
            problems.append(f"SPLIT names {name!r}, which is not a check")

    for command in ci_only:
        holders = [j for j, commands in runs.items() if command in commands]
        if not holders:
            problems.append(f"CI_ONLY command ({command}) is run by no job of ci.yml")
        elif gated is not None and not any(job in covered for job in holders):
            problems.append(f"CI_ONLY command ({command}) is not in a job ci: covers")

    for name in gated or []:
        if name not in runs:
            problems.append(f"ci: names {name!r}, which is not a job of ci.yml")

    known = {
        *setup.values(),
        *(command for name, command in checks.items() if name not in split),
        *expanded.values(),
        *ci_only,
        VERDICT,
    }
    for job, commands in runs.items():
        problems.extend(
            f"job {job!r} runs an unknown step: {command}"
            for command in commands
            if command not in known
        )
    problems.extend(_aggregator_problems(workflow, runs))
    return problems


def _aggregator_problems(workflow: Data, runs: dict[str, list[str]]) -> list[str]:
    jobs: Data = workflow["jobs"]
    if AGGREGATOR not in jobs:
        return [f"ci.yml has no {AGGREGATOR!r} job"]
    problems: list[str] = []
    job = jobs[AGGREGATOR]
    others = sorted(j for j in jobs if j != AGGREGATOR)
    if sorted(_needs(job)) != others:
        problems.append(f"job {AGGREGATOR!r} needs {sorted(_needs(job))}, not every other job")
    if job.get("if") != "always()":
        problems.append(f"job {AGGREGATOR!r} does not run with `if: always()`")
    if runs[AGGREGATOR] != [VERDICT]:
        problems.append(f"job {AGGREGATOR!r} runs {runs[AGGREGATOR]}, not only the verdict script")
    return problems


def workflow_problems(workflow: Data) -> list[str]:
    """The shape rules: permissions, matrices, the e2e shards' needs and the upload names."""
    problems: list[str] = []
    jobs: Data = workflow["jobs"]
    runs = _runs(workflow)
    if workflow.get("permissions") != {"contents": "read"}:
        problems.append("the default permissions are not `contents: read`")

    for job_id, job in jobs.items():
        written = {
            scope for scope, level in (job.get("permissions") or {}).items() if level == "write"
        }
        if written - WRITERS.get(job_id, set()):
            problems.append(f"job {job_id!r} may write {sorted(written)}")
        matrix: Data = (job.get("strategy") or {}).get("matrix") or {}
        for key, value in matrix.items():
            if not (
                isinstance(value, str)
                and "fromJSON(needs.changes.outputs." in value
                and value.startswith("${{")
            ):
                problems.append(f"job {job_id!r} matrix {key!r} is not read from `changes`")
        if "matrix" in job.get("strategy", {}) and "changes" not in _needs(job):
            problems.append(f"job {job_id!r} has a matrix and does not need `changes`")
        for step in job["steps"]:
            if str(step.get("uses", "")).startswith("actions/upload-artifact"):
                name = str(step["with"]["name"])
                if name.startswith("coverage-pytest") and name != _coverage_name(job_id):
                    problems.append(f"job {job_id!r} uploads coverage as {name!r}")

    if not any("playwright install" in command for command in runs.get("web", [])):
        problems.append("job 'web' does not install Chromium, which the census unit project drives")

    e2e_needs = sorted(_needs(jobs["e2e"]))
    if e2e_needs != ["build", "changes"]:
        problems.append(f"job 'e2e' needs {e2e_needs}, not only changes and build")
    for needed in e2e_needs:
        problems.extend(
            f"job 'e2e' needs {needed!r}, which runs {command}"
            for command in runs.get(needed, [])
            if _is_forbidden_before_e2e(command)
        )
    return problems


def _coverage_name(job_id: str) -> str:
    return coverage_artifact("always" if job_id == "test" else "${{ matrix.group }}")


def _is_forbidden_before_e2e(command: str) -> bool:
    forbidden = {STACK["checks"][name] for name in BEFORE_E2E_FORBIDDEN if name in STACK["checks"]}
    return command in forbidden or any(
        template.replace("{check}", STACK["checks"][name]) == command
        for name, (_, template) in SPLIT.items()
        if name in BEFORE_E2E_FORBIDDEN
    )


def _with_ci(stack: Data, gated: list[str]) -> Data:
    return {**copy.deepcopy(stack), "ci": gated}


def _without_ci(stack: Data) -> Data:
    return {key: copy.deepcopy(value) for key, value in stack.items() if key != "ci"}


def _renamed(workflow: Data, old: str, new: str) -> Data:
    jobs = {(new if job == old else job): body for job, body in workflow["jobs"].items()}
    return {**copy.deepcopy(workflow), "jobs": copy.deepcopy(jobs)}


def _problems(stack: Data = STACK, workflow: Data = WORKFLOW) -> list[str]:
    return stack_ci_problems(stack, workflow, CI_ONLY, SPLIT)


def test_ci_yml_runs_the_declared_checks_and_nothing_unnamed() -> None:
    assert _problems(_without_ci(STACK)) == []


def test_the_same_holds_once_ci_is_turned_on() -> None:
    assert _problems(_with_ci(STACK, GATED)) == []


def test_stack_yaml_gates_a_merge_on_the_aggregator_alone() -> None:
    assert STACK["ci"] == GATED


def test_the_workflow_shape_holds() -> None:
    assert workflow_problems(WORKFLOW) == []


def test_the_test_job_waits_for_nothing() -> None:
    assert "needs" not in WORKFLOW["jobs"]["test"]


def test_a_renamed_aggregator_is_not_a_job_the_gate_names() -> None:
    problems = _problems(_with_ci(STACK, GATED), _renamed(WORKFLOW, AGGREGATOR, "all-green"))
    assert any("ci: names 'ci-ok'" in p for p in problems)
    assert any("has no 'ci-ok' job" in p for p in problems)


def test_a_check_in_a_job_the_aggregator_does_not_need_is_refused_when_ci_is_on() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"][AGGREGATOR]["needs"].remove("build")
    problems = _problems(_with_ci(STACK, GATED), workflow)
    assert any("'web-build'" in p and "ci: does not cover" in p for p in problems)
    assert any("not every other job" in p for p in problems)


def test_a_ci_only_command_in_a_job_ci_does_not_cover_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"][AGGREGATOR]["needs"].remove("changes")
    problems = _problems(_with_ci(STACK, GATED), workflow)
    assert any(p.startswith("CI_ONLY command") and "not in a job ci: covers" in p for p in problems)


def test_a_ci_only_entry_no_job_runs_is_refused() -> None:
    ci_only = {**CI_ONLY, "npm --prefix web run storybook": "a step nobody runs"}
    problems = stack_ci_problems(STACK, WORKFLOW, ci_only, SPLIT)
    assert problems == [
        "CI_ONLY command (npm --prefix web run storybook) is run by no job of ci.yml"
    ]


def test_an_unknown_step_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["test"]["steps"].append({"run": "make everything-green"})
    assert _problems(workflow=workflow) == [
        "job 'test' runs an unknown step: make everything-green"
    ]


def test_a_check_missing_from_ci_yml_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["web-docs"] = "npm --prefix web run docs"
    assert any("'web-docs'" in p and "0 jobs" in p for p in _problems(stack))


def test_a_check_run_by_two_jobs_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["e2e"]["steps"].append({"run": STACK["checks"]["types"]})
    assert any("'types'" in p and "2 jobs" in p for p in _problems(workflow=workflow))


def test_a_check_that_differs_from_its_ci_step_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["types"] = "uv run --no-project mypy app tests"
    problems = _problems(stack)
    assert any("'types'" in p for p in problems)
    assert any("mypy app tests scripts" in p and "unknown step" in p for p in problems)


def test_a_split_check_that_changes_its_command_is_refused_until_its_step_follows() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["tests"] = "uv run --no-project pytest -n 4"
    problems = _problems(stack)
    assert any("check 'tests' must be the step" in p and "-n 4" in p for p in problems)


def test_a_split_check_run_bare_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["web"]["steps"].append({"run": STACK["checks"]["web-tests"]})
    problems = _problems(workflow=workflow)
    assert problems == [f"job 'web' runs an unknown step: {STACK['checks']['web-tests']}"]


def test_a_split_check_in_the_wrong_job_is_refused() -> None:
    split = {**SPLIT, "web-tests": ("e2e", SPLIT["web-tests"][1])}
    problems = stack_ci_problems(STACK, WORKFLOW, CI_ONLY, split)
    assert any("check 'web-tests' must be the step" in p and "job 'e2e'" in p for p in problems)


def test_a_split_entry_for_no_check_is_refused() -> None:
    split = {**SPLIT, "web-docs": ("web", "{check}")}
    assert stack_ci_problems(STACK, WORKFLOW, CI_ONLY, split) == [
        "SPLIT names 'web-docs', which is not a check"
    ]


def test_an_aggregator_that_does_not_always_run_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    del workflow["jobs"][AGGREGATOR]["if"]
    assert _problems(workflow=workflow) == ["job 'ci-ok' does not run with `if: always()`"]


def test_an_aggregator_with_another_step_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"][AGGREGATOR]["steps"].append({"run": STACK["checks"]["lint"]})
    problems = _problems(workflow=workflow)
    assert any("not only the verdict script" in p for p in problems)


def test_an_aggregator_that_leaves_a_job_out_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"][AGGREGATOR]["needs"].remove("coverage")
    assert any("not every other job" in p for p in _problems(workflow=workflow))


def test_a_matrix_written_as_a_literal_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["pytest"]["strategy"]["matrix"]["group"] = ["rest", "sales"]
    assert workflow_problems(workflow) == ["job 'pytest' matrix 'group' is not read from `changes`"]


def test_a_matrix_read_from_another_job_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["e2e"]["strategy"]["matrix"]["shard"] = (
        "${{ fromJSON(needs.build.outputs.x) }}"
    )
    assert workflow_problems(workflow) == ["job 'e2e' matrix 'shard' is not read from `changes`"]


def test_an_e2e_shard_that_waits_for_the_unit_tests_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["e2e"]["needs"] = ["changes", "build", "web"]
    problems = workflow_problems(workflow)
    assert problems[0] == "job 'e2e' needs ['build', 'changes', 'web'], not only changes and build"
    assert f"job 'e2e' needs 'web', which runs {STACK['checks']['web-types']}" in problems


def test_an_e2e_shard_whose_build_job_runs_lint_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["build"]["steps"].append({"run": STACK["checks"]["lint"]})
    problems = workflow_problems(workflow)
    assert problems == [f"job 'e2e' needs 'build', which runs {STACK['checks']['lint']}"]


def test_a_web_job_without_the_browser_install_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    steps = workflow["jobs"]["web"]["steps"]
    workflow["jobs"]["web"]["steps"] = [s for s in steps if "playwright" not in str(s.get("run"))]
    assert workflow_problems(workflow) == [
        "job 'web' does not install Chromium, which the census unit project drives"
    ]


def test_a_write_permission_outside_the_coverage_job_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["web"]["permissions"] = {"contents": "read", "pull-requests": "write"}
    assert workflow_problems(workflow) == ["job 'web' may write ['pull-requests']"]


def test_a_default_permission_that_writes_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["permissions"] = {"contents": "write"}
    assert workflow_problems(workflow) == ["the default permissions are not `contents: read`"]


def test_a_coverage_upload_under_another_name_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    for step in workflow["jobs"]["pytest"]["steps"]:
        if str(step.get("uses", "")).startswith("actions/upload-artifact"):
            step["with"]["name"] = "coverage-pytest-rest"
    assert workflow_problems(workflow) == [
        "job 'pytest' uploads coverage as 'coverage-pytest-rest'"
    ]


@pytest.mark.parametrize("command", sorted(CI_ONLY))
def test_every_ci_only_entry_has_a_reason(command: str) -> None:
    assert CI_ONLY[command].strip()


def test_actionlint_passes_on_the_workflow() -> None:
    actionlint = Path(sys.executable).parent / "actionlint"
    done = subprocess.run(
        [str(actionlint), str(WORKFLOW_PATH)], capture_output=True, text=True, check=False
    )
    assert done.returncode == 0, done.stdout + done.stderr
