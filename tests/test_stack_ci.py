"""Local checks and CI run one list (ADR-0054): every `checks` command of
`.agentic/stack.yaml` is a `run:` step of exactly one job of `.github/workflows/ci.yml`,
and every `run:` step of that file is a `setup` command, a `checks` command or a named
`CI_ONLY` or `PARKED` entry, and every `CI_ONLY` and `PARKED` entry is run by some job, and
no command is in both dicts. A `PARKED` command runs in CI on every pull request and gates
nothing. When `stack.yaml` has `ci:`, the gated jobs are the job ids of `ci.yml` and together
hold every check and every `CI_ONLY` command, and no gated job holds a `PARKED` command. When it
has `docs:`, `docs.generate` is a known step that exactly one job runs (gated when `ci:` is
declared) and it is in no `checks`, `CI_ONLY` or `PARKED` entry.
`stack_ci_problems` is a pure function over the parsed YAML, so the rejections are tested on
in-memory data; the real files are checked with `ci:` absent (today) and with it added to a copy."""

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
}

# Commands CI runs on every pull request that gate no merge, each with the reason it is parked
# and when it joins `ci:`. A parked command never sits in a gated job.
PARKED: dict[str, str] = {
    "npm --prefix web run e2e": (
        "off locally by the owner (2026-10-26, PR #434) and flaky under #428; "
        "joins ci: when both are lifted"
    ),
}

Data = dict[str, Any]


def _load(path: Path) -> Data:
    return cast("Data", yaml.safe_load(path.read_text()))


STACK = _load(REPO_ROOT / ".agentic" / "stack.yaml")
WORKFLOW = _load(REPO_ROOT / ".github" / "workflows" / "ci.yml")
GATED = ["test", "web", "docs"]


def _runs(workflow: Data) -> dict[str, list[str]]:
    """The `run:` commands of each job, in order."""
    return {
        job_id: [cast("str", step["run"]).strip() for step in job["steps"] if "run" in step]
        for job_id, job in workflow["jobs"].items()
    }


def _generate_problems(
    generate: str,
    runs: dict[str, list[str]],
    gated: list[str] | None,
    checks: dict[str, str],
    ci_only: dict[str, str],
    parked: dict[str, str],
) -> list[str]:
    """What keeps `docs.generate` from being one step of one gated job and nothing else."""
    problems: list[str] = []
    holders = [job for job, commands in runs.items() if generate in commands]
    if len(holders) != 1:
        problems.append(f"docs.generate ({generate}) is a step of {len(holders)} jobs, not 1")
    elif gated is not None and holders[0] not in gated:
        problems.append(f"docs.generate runs in job {holders[0]!r}, not in ci:")
    if generate in ci_only:
        problems.append(f"docs.generate ({generate}) is also in CI_ONLY")
    if generate in parked:
        problems.append(f"docs.generate ({generate}) is also in PARKED")
    problems.extend(
        f"docs.generate ({generate}) is also in checks {name!r}"
        for name, command in checks.items()
        if command == generate
    )
    return problems


def stack_ci_problems(
    stack: Data, workflow: Data, ci_only: dict[str, str], parked: dict[str, str]
) -> list[str]:
    """What keeps `stack` and `workflow` from being one list of checks."""
    problems: list[str] = []
    runs = _runs(workflow)
    checks: dict[str, str] = stack["checks"]
    setup: dict[str, str] = stack["setup"]
    gated: list[str] | None = stack.get("ci")
    docs: Data | None = stack.get("docs")
    generate: str | None = docs["generate"] if docs is not None else None

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
            holders = [job for job, commands in runs.items() if command in commands]
            if holders and not any(job in gated for job in holders):
                problems.append(f"CI_ONLY command ({command}) is not in a gated job")
        for command in parked:
            problems.extend(
                f"PARKED command ({command}) is in gated job {job!r}"
                for job, commands in runs.items()
                if command in commands and job in gated
            )

    known = {*setup.values(), *checks.values(), *ci_only, *parked}
    if generate is not None:
        known.add(generate)
        problems.extend(_generate_problems(generate, runs, gated, checks, ci_only, parked))
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


def test_a_ci_only_command_in_an_ungated_job_is_refused_when_ci_is_on() -> None:
    install = "npx --prefix web playwright install --with-deps chromium"
    problems = stack_ci_problems(_with_ci(STACK, ["test"]), WORKFLOW, CI_ONLY, PARKED)
    assert f"CI_ONLY command ({install}) is not in a gated job" in problems


def test_a_parked_command_in_a_gated_job_is_refused() -> None:
    problems = stack_ci_problems(_with_ci(STACK, [*GATED, "e2e"]), WORKFLOW, CI_ONLY, PARKED)
    assert problems == ["PARKED command (npm --prefix web run e2e) is in gated job 'e2e'"]


def test_a_parked_command_no_job_runs_is_refused() -> None:
    parked = {**PARKED, "npm --prefix web run storybook": "a step nobody runs"}
    problems = stack_ci_problems(STACK, WORKFLOW, CI_ONLY, parked)
    assert problems == [
        "PARKED command (npm --prefix web run storybook) is run by no job of ci.yml"
    ]


def test_a_command_in_both_dicts_is_refused() -> None:
    e2e = "npm --prefix web run e2e"
    ci_only = {**CI_ONLY, e2e: "also listed as CI_ONLY"}
    problems = stack_ci_problems(_without_ci(STACK), WORKFLOW, ci_only, PARKED)
    assert problems == [f"command ({e2e}) is in both CI_ONLY and PARKED"]


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


GENERATE = "uv run --no-project python -m scripts.docs.generate"
DOCS_OWNED = ("docs/architecture/generated", "docs/api")


def _without_generate_step(workflow: Data) -> Data:
    copied = copy.deepcopy(workflow)
    for body in copied["jobs"].values():
        body["steps"] = [step for step in body["steps"] if step.get("run", "").strip() != GENERATE]
    return copied


def test_docs_generate_is_declared_and_is_a_step_of_the_docs_job() -> None:
    assert STACK["docs"]["generate"] == GENERATE
    assert [job for job, commands in _runs(WORKFLOW).items() if GENERATE in commands] == ["docs"]


def test_a_docs_generate_no_job_runs_is_refused() -> None:
    problems = stack_ci_problems(STACK, _without_generate_step(WORKFLOW), CI_ONLY, PARKED)
    assert problems == [f"docs.generate ({GENERATE}) is a step of 0 jobs, not 1"]


def test_a_docs_generate_run_by_two_jobs_is_refused() -> None:
    workflow = copy.deepcopy(WORKFLOW)
    workflow["jobs"]["e2e"]["steps"].append({"run": GENERATE})
    problems = stack_ci_problems(STACK, workflow, CI_ONLY, PARKED)
    assert problems == [f"docs.generate ({GENERATE}) is a step of 2 jobs, not 1"]


def test_a_docs_generate_in_a_job_outside_ci_is_refused() -> None:
    problems = stack_ci_problems(_with_ci(STACK, ["test", "web"]), WORKFLOW, CI_ONLY, PARKED)
    assert "docs.generate runs in job 'docs', not in ci:" in problems


def test_without_ci_the_docs_generate_is_still_counted_but_never_gated() -> None:
    stack = _without_ci(STACK)
    assert stack_ci_problems(stack, WORKFLOW, CI_ONLY, PARKED) == []
    zero = stack_ci_problems(stack, _without_generate_step(WORKFLOW), CI_ONLY, PARKED)
    assert zero == [f"docs.generate ({GENERATE}) is a step of 0 jobs, not 1"]
    two = copy.deepcopy(WORKFLOW)
    two["jobs"]["e2e"]["steps"].append({"run": GENERATE})
    assert stack_ci_problems(stack, two, CI_ONLY, PARKED) == [
        f"docs.generate ({GENERATE}) is a step of 2 jobs, not 1"
    ]


def test_a_docs_generate_still_listed_in_ci_only_is_refused() -> None:
    ci_only = {**CI_ONLY, GENERATE: "the docs generator"}
    problems = stack_ci_problems(STACK, WORKFLOW, ci_only, PARKED)
    assert problems == [f"docs.generate ({GENERATE}) is also in CI_ONLY"]


def test_a_docs_generate_listed_as_parked_is_refused() -> None:
    parked = {**PARKED, GENERATE: "the docs generator"}
    problems = stack_ci_problems(STACK, WORKFLOW, CI_ONLY, parked)
    assert f"docs.generate ({GENERATE}) is also in PARKED" in problems


def test_a_docs_generate_that_is_also_a_check_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["gen"] = GENERATE
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY, PARKED)
    assert f"docs.generate ({GENERATE}) is also in checks 'gen'" in problems


def test_without_a_docs_block_the_generate_command_is_an_unknown_step() -> None:
    stack = {key: value for key, value in copy.deepcopy(STACK).items() if key != "docs"}
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY, PARKED)
    assert problems == [f"job 'docs' runs an unknown step: {GENERATE}"]


def docs_reservation_problems(stack: Data) -> list[str]:
    """What breaks the reservation of the `docs` check and its paths: the system adds the
    check, and no command the product declares reads the paths the generator owns."""
    problems: list[str] = []
    if "docs" in stack["checks"]:
        problems.append("checks declares a check named 'docs'")
    if "docs" in stack.get("delivery_checks", []):
        problems.append("delivery_checks lists 'docs'")
    for section in ("setup", "checks", "affected_checks"):
        for name, command in stack.get(section, {}).items():
            problems.extend(
                f"{section} {name!r} reads {path}" for path in DOCS_OWNED if path in command
            )
    return problems


@pytest.mark.skipif("docs" not in STACK, reason="stack.yaml declares no docs: block")
def test_the_docs_check_and_its_paths_are_reserved() -> None:
    assert docs_reservation_problems(STACK) == []


def test_a_declared_docs_check_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["docs"] = GENERATE
    stack["delivery_checks"].append("docs")
    assert docs_reservation_problems(stack) == [
        "checks declares a check named 'docs'",
        "delivery_checks lists 'docs'",
    ]


def test_a_command_that_reads_the_owned_paths_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["setup"]["peek"] = "cat docs/api/openapi.json"
    stack["checks"]["stale"] = "git diff --exit-code -- docs/architecture/generated"
    stack["affected_checks"]["web-tests"] += " docs/api"
    assert docs_reservation_problems(stack) == [
        "setup 'peek' reads docs/api",
        "checks 'stale' reads docs/architecture/generated",
        "affected_checks 'web-tests' reads docs/api",
    ]


def test_a_check_that_differs_from_its_ci_step_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["types"] = "uv run --no-project mypy app tests"
    problems = stack_ci_problems(stack, WORKFLOW, CI_ONLY, PARKED)
    assert any("'types'" in p for p in problems)
    assert any("mypy app tests scripts" in p and "unknown step" in p for p in problems)


@pytest.mark.parametrize("command", sorted(CI_ONLY))
def test_every_ci_only_entry_has_a_reason(command: str) -> None:
    assert CI_ONLY[command].strip()


@pytest.mark.parametrize("command", sorted(PARKED))
def test_every_parked_entry_has_a_reason(command: str) -> None:
    assert PARKED[command].strip()
