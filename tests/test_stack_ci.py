"""Local checks and CI run one list (ADR-0054, amended by GH-476): the gated jobs of
`.github/workflows/ci.yml` are the `needs` closure of the job ids `ci:` names in
`.agentic/stack.yaml` (only `ci-ok`). Every check is either a `run:` step of exactly one gated job
or has a `CI_FORMS` entry whose command is a step of a gated job, never both; a `CI_FORMS` key
that is not a check, or a value no gated job runs, is refused. Every other `run:` step is a
`setup` command or a named `CI_ONLY` entry, and every `CI_ONLY` entry is run by some job.
`ci-ok` needs every other job and runs `if: always()`; the always-on jobs carry no skip `if:`;
the suites are skipped only by their `changes` flag, and the `e2e` aggregator (the one job besides
the always-on ones that carries `always()`) is pinned apart: it needs `changes` and `e2e-shard`,
reads only `needs.e2e-shard.result` and runs no checkout, no `uv` and no check;
every job `ci-ok` needs has a judge in `scripts/ci_verdict.py` (except `changes`);
`ci_covers.web-e2e` names the aggregator, and its `failed` regex is read from `stack.yaml`;
the workflow's permissions, concurrency, fetch depth, fork guard, hidden-file uploads and output
names are pinned.
When `stack.yaml` has `docs:`, `docs.generate` is a known step that exactly one gated job runs
and it is in no `checks`, `CI_ONLY` or `CI_FORMS` entry; the system adds the `docs` check, so
none is declared and no declared command reads the generator's paths.
`stack_ci_problems` is a pure function over the parsed YAML, so each rule is tested on in-memory
data; the real files are checked as they are."""

from __future__ import annotations

import copy
import re
from pathlib import Path
from typing import Any, cast

import pytest
import yaml

from scripts.ci_changes import render, select
from scripts.ci_coverage import MARKER
from scripts.ci_verdict import ALWAYS_JOBS, CHANGES, SUITES, WARN_JOBS

REPO_ROOT = Path(__file__).resolve().parents[1]

Data = dict[str, Any]

VERDICT_RUN = """printf '%s' "$NEEDS" | uv run --no-project python scripts/ci_verdict.py"""
COMMENT_RUN = (
    """id=$(gh api "repos/$REPO/issues/$PR/comments" --paginate --jq '.[] | select(.body | """
    """contains(env.MARKER)) | .id' | head -n 1); if [ -n "$id" ]; then gh api --method PATCH """
    """"repos/$REPO/issues/comments/$id" --field body=@coverage-report.md; else gh api --method """
    """POST "repos/$REPO/issues/$PR/comments" --field body=@coverage-report.md; fi"""
)
PYTEST_RUN = "uv run --no-project pytest -n auto --cov --cov-report= -- $PATHS"
VITEST_RUN = "npm --prefix web test -- --coverage $VITEST_ARGS"
E2E_RUN = 'npm --prefix web run e2e -- --shard="$SHARD" $E2E_ARGS'
E2E_GATE_RUN = 'test "$RESULT" = success || { echo "e2e shards: $RESULT"; exit 1; }'
E2E_GATE_IF = "always() && needs.changes.outputs.e2e == 'true'"
E2E_GATE_RESULT = "${{ needs.e2e-shard.result }}"
CHANGES_RUN = 'uv run --no-project python -m scripts.ci_changes "$EVENT" "$REF" >> "$GITHUB_OUTPUT"'
VITEST_LIST_RUN = (
    'if [ -n "$BASE_REF" ]; then npx --prefix web vitest list --root web --changed="$BASE_REF" '
    '--filesOnly > "$RUNNER_TEMP/vitest-listed.txt"; '
    'else : > "$RUNNER_TEMP/vitest-listed.txt"; fi'
)
EVENT_EXPRESSION = "${{ github.event_name }}"
REF_EXPRESSION = "${{ github.ref }}"
BASE_REF_EXPRESSION = "${{ needs.changes.outputs.base_ref }}"
CANCEL_IN_PROGRESS = (
    "${{ github.event_name == 'pull_request' || "
    "(github.event_name == 'push' && startsWith(github.ref, 'refs/heads/agentic-ci/')) }}"
)
PUSH_BRANCHES = ["master", "agentic-ci/**"]

# Commands that only CI runs, each with the reason it is not a local check.
CI_ONLY: dict[str, str] = {
    "npx --prefix web playwright install --with-deps chromium": (
        "the runner needs the root `--with-deps` form of `setup.web-browsers`"
    ),
    CHANGES_RUN: (
        "the `changes` job: which suites the pull request or an agentic-ci push affects (ADR-0064)"
    ),
    VITEST_LIST_RUN: (
        "vitest's own listing from `base_ref`, empty without one; run by the workflow so no script "
        "runs a node tool (ADR-0064 §6)"
    ),
    (
        'uv run --no-project python -m scripts.ci_vitest "$RUNNER_TEMP/vitest-listed.txt" '
        '>> "$GITHUB_OUTPUT"'
    ): "the vitest arguments from the listing and the changed test files",
    """printf '%s' "$SELECTION" > selection.json""": (
        "hands the `changes` selection to the coverage report"
    ),
    (
        "uv run --no-project coverage combine coverage-data/coverage-pytest-*/ && "
        "uv run --no-project coverage json -o coverage-data/coverage.json"
    ): "joins the pytest shards' data; only CI has shards",
    (
        "uv run --no-project python scripts/ci_coverage.py report --selection selection.json "
        "--pytest-json coverage-data/coverage.json "
        "--vitest-summary coverage-data/coverage-vitest/coverage-summary.json "
        "--baseline docs/ci/coverage-baseline.md > coverage-report.md"
    ): "the coverage Markdown; reported, never gated",
    'cat coverage-report.md >> "$GITHUB_STEP_SUMMARY"': "the job summary exists only in CI",
    COMMENT_RUN: "the pull request comment, updated in place by its marker; CI only",
    (
        'echo "Coverage failed: no pytest data from '
        "$(printf '%s' \"$MATRIX\" | jq '.include | length') shards "
        '(a shard failed before uploading, or none ran)." | tee -a "$GITHUB_STEP_SUMMARY" '
        "&& exit 1"
    ): "the coverage job's own failure reason; a warning in ci-ok",
    VERDICT_RUN: "the merge condition: one verdict over every job's result and the `changes` flags",
    E2E_GATE_RUN: (
        "the `e2e` aggregator: green only when every `e2e-shard` is; `ci_covers` names it"
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

# Checks CI runs in another form (shards, coverage, selected specs): check -> the exact `run:`
# line of a gated job. A check here is proven when every shard the `changes` job selected either
# succeeded or was skipped on a "false" flag (ADR-0054, amended).
CI_FORMS: dict[str, str] = {
    "tests": PYTEST_RUN,
    "tests-fast": PYTEST_RUN,
    "web-tests": VITEST_RUN,
    "web-e2e": E2E_RUN,
}

# Jobs that always run: no `if:` other than `always()`.
NO_SKIP_JOBS = ("changes", "checks", "web", "docs", "coverage", "ci-ok")
SUITE_JOBS = ("pytest", "vitest", "e2e-shard")
# The aggregator over the `e2e-shard` matrix: the one check-run named exactly `e2e` (GH-453).
E2E_GATE = "e2e"
E2E_SHARD = "e2e-shard"
COVERAGE = "coverage"
OUTPUT_PREFIXES = ("needs.changes.outputs.", "steps.vitest-args.outputs.")
EXPECTED_CONCURRENCY = {
    "group": "ci-${{ github.workflow }}-${{ github.ref }}",
    "cancel-in-progress": CANCEL_IN_PROGRESS,
}
# Functions a GitHub Actions expression may call (the documented set); anything else, such as
# `length(`, makes GitHub reject the whole workflow file, so no job runs.
EXPRESSION_FUNCTIONS = frozenset(
    {
        "contains",
        "startsWith",
        "endsWith",
        "format",
        "join",
        "toJSON",
        "fromJSON",
        "hashFiles",
        "success",
        "always",
        "cancelled",
        "failure",
        "case",
    }
)
FORK_GUARD = (
    "github.event_name == 'pull_request' && "
    "github.event.pull_request.head.repo.full_name == github.repository"
)


def _load(path: Path) -> Data:
    return cast("Data", yaml.safe_load(path.read_text()))


STACK = _load(REPO_ROOT / ".agentic" / "stack.yaml")
WORKFLOW = _load(REPO_ROOT / ".github" / "workflows" / "ci.yml")
# `base_ref` is printed by `ci_changes.main`, after the lines `render` makes.
OUTPUT_NAMES = {line.split("=", 1)[0] for line in render(select(None, REPO_ROOT))} | {
    "args",
    "base_ref",
}


def _steps(job: Data) -> list[Data]:
    return cast("list[Data]", job["steps"])


def _runs(workflow: Data) -> dict[str, list[str]]:
    """The `run:` commands of each job, in order."""
    return {
        job_id: [cast("str", step["run"]).strip() for step in _steps(job) if "run" in step]
        for job_id, job in workflow["jobs"].items()
    }


def _needs(job: Data) -> list[str]:
    needs = job.get("needs", [])
    return [needs] if isinstance(needs, str) else list(needs)


def _closure(workflow: Data, roots: list[str]) -> set[str]:
    """The jobs `roots` name and, transitively, every job they `needs`."""
    jobs: Data = workflow["jobs"]
    seen: set[str] = set()
    pending = [root for root in roots if root in jobs]
    while pending:
        job = pending.pop()
        if job not in seen:
            seen.add(job)
            pending.extend(need for need in _needs(jobs[job]) if need in jobs)
    return seen


def _output_references(workflow: Data) -> set[str]:
    """Every output name read through `needs.changes.outputs.X` or `steps.vitest-args.outputs.X`."""
    text = yaml.safe_dump(workflow)
    names: set[str] = set()
    for prefix in OUTPUT_PREFIXES:
        for part in text.split(prefix)[1:]:
            name = ""
            for char in part:
                if not (char.isalnum() or char == "_"):
                    break
                name += char
            names.add(name)
    return names


def _structure_problems(
    workflow: Data, ci_names: list[str], workflow_checks: dict[str, str]
) -> list[str]:
    """Permissions, concurrency, `if:` rules, fetch depth, the fork guard and the uploads."""
    problems: list[str] = []
    jobs: Data = workflow["jobs"]

    if workflow.get("permissions") != {"contents": "read"}:
        problems.append("the workflow's permissions are not exactly `contents: read`")
    if workflow.get("concurrency") != EXPECTED_CONCURRENCY:
        problems.append(f"concurrency is not {EXPECTED_CONCURRENCY}")
    for job_id, job in jobs.items():
        grants = cast("Data", job.get("permissions", {}))
        if grants.get("pull-requests") == "write" and job_id != COVERAGE:
            problems.append(f"job {job_id!r} holds pull-requests: write; only {COVERAGE!r} may")
    if cast("Data", jobs.get(COVERAGE, {}).get("permissions", {})).get("pull-requests") != "write":
        problems.append(f"job {COVERAGE!r} does not hold pull-requests: write")

    for name in ci_names:
        if name in jobs:
            others = sorted(job for job in jobs if job != name)
            if sorted(_needs(jobs[name])) != others:
                problems.append(f"{name!r} needs {sorted(_needs(jobs[name]))}, not every other job")
            if jobs[name].get("if") != "always()":
                problems.append(f"{name!r} does not carry `if: always()`")

    for job_id in NO_SKIP_JOBS:
        condition = jobs.get(job_id, {}).get("if")
        if job_id in jobs and condition not in (None, "always()"):
            problems.append(f"job {job_id!r} carries a skip `if:` ({condition})")
    for job_id in SUITE_JOBS:
        expected = f"needs.changes.outputs.{SUITES[job_id]} == 'true'"
        if job_id in jobs and jobs[job_id].get("if") != expected:
            problems.append(f"job {job_id!r} `if:` is not `{expected}`")

    problems.extend(_always_problems(jobs))
    problems.extend(_e2e_gate_problems(jobs, workflow_checks))
    problems.extend(_judge_problems(jobs))
    problems.extend(_changes_problems(jobs.get("changes")))
    problems.extend(_vitest_problems(jobs.get("vitest")))
    problems.extend(_trigger_problems(workflow))
    problems.extend(_coverage_problems(jobs))
    problems.extend(_expression_problems(workflow))
    problems.extend(_browser_problems(workflow))
    return problems


def _always_problems(jobs: Data) -> list[str]:
    """`always()` in a job's `if:` is for the always-on jobs and `E2E_GATE` only."""
    allowed = {*NO_SKIP_JOBS, E2E_GATE}
    return [
        f"job {job_id!r} carries `always()` in its `if:` ({job['if']})"
        for job_id, job in jobs.items()
        if "always()" in str(job.get("if", "")) and job_id not in allowed
    ]


def _e2e_gate_problems(jobs: Data, checks: dict[str, str]) -> list[str]:
    """The aggregator reads one result: no checkout, no matrix, no `uv`, no check command."""
    gate = cast("Data | None", jobs.get(E2E_GATE))
    if gate is None:
        return [f"there is no {E2E_GATE!r} job"]
    problems: list[str] = []
    if gate.get("if") != E2E_GATE_IF:
        problems.append(f"job {E2E_GATE!r} `if:` is not `{E2E_GATE_IF}`")
    if _needs(gate) != ["changes", E2E_SHARD]:
        problems.append(f"job {E2E_GATE!r} needs {_needs(gate)}, not ['changes', {E2E_SHARD!r}]")
    if "strategy" in gate:
        problems.append(f"job {E2E_GATE!r} has a strategy; it must be one check-run")
    steps = _steps(gate)
    if len(steps) != 1:
        problems.append(f"job {E2E_GATE!r} has {len(steps)} steps, not 1")
    for step in steps:
        if "uses" in step:
            problems.append(f"job {E2E_GATE!r} runs a `uses:` step ({step['uses']})")
        run = str(step.get("run", "")).strip()
        if run != E2E_GATE_RUN:
            problems.append(f"job {E2E_GATE!r} step is not `{E2E_GATE_RUN}`")
        if "uv" in run.split() or any(command in run for command in checks.values()):
            problems.append(f"job {E2E_GATE!r} runs `uv` or a check command: {run}")
        if cast("Data", step.get("env", {})) != {"RESULT": E2E_GATE_RESULT}:
            problems.append(f"job {E2E_GATE!r} env is not exactly RESULT: {E2E_GATE_RESULT}")
    return problems


def _judge_problems(jobs: Data) -> list[str]:
    """Every job `ci-ok` needs, but `changes`, has a judge in `scripts/ci_verdict.py`."""
    judged = {*SUITES, *ALWAYS_JOBS, *WARN_JOBS}
    return [
        f"ci-ok needs {job!r}, which scripts/ci_verdict.py does not judge"
        for job in _needs(jobs.get("ci-ok", {}))
        if job != CHANGES and job not in judged
    ]


CHROMIUM_RUN = "npx --prefix web playwright install --with-deps chromium"


def _browser_problems(workflow: Data) -> list[str]:
    """A job that runs vitest or Playwright needs Chromium first (the census test launches it)."""
    problems: list[str] = []
    for job_id, job in cast("Data", workflow["jobs"]).items():
        runs = [str(step.get("run", "")) for step in _steps(job)]
        browser = [i for i, run in enumerate(runs) if run in (VITEST_RUN, E2E_RUN)]
        if browser and not any(run == CHROMIUM_RUN for run in runs[: browser[0]]):
            problems.append(
                f"job {job_id!r} runs a browser suite without installing Chromium first"
            )
    return problems


def _expression_problems(workflow: Data) -> list[str]:
    """Every function called inside a `${{ }}` or an `if:` must be one GitHub documents."""
    texts = re.findall(r"\$\{\{(.*?)\}\}", yaml.safe_dump(workflow, width=10**6), re.DOTALL)
    for job in cast("Data", workflow["jobs"]).values():
        texts.extend(str(step["if"]) for step in _steps(job) if "if" in step)
        texts.append(str(job.get("if", "")))
    called = {name for text in texts for name in re.findall(r"([A-Za-z_]\w*)\s*\(", text)}
    return [
        f"expression function {name!r} is not one GitHub Actions documents"
        for name in sorted(called - EXPRESSION_FUNCTIONS)
    ]


def _checkouts(job: Data) -> list[Data]:
    return [
        step for step in _steps(job) if str(step.get("uses", "")).startswith("actions/checkout")
    ]


def _changes_problems(changes: Data | None) -> list[str]:
    if changes is None:
        return ["there is no `changes` job"]
    problems: list[str] = []
    steps = _steps(changes)
    if not any(step.get("with", {}).get("fetch-depth") == 0 for step in _checkouts(changes)):
        problems.append("the `changes` checkout does not set fetch-depth: 0")
    runners = [step for step in steps if "ci_changes" in str(step.get("run", ""))]
    for step in runners:
        env = cast("Data", step.get("env", {}))
        if (
            "${{" in step["run"]
            or env.get("EVENT") != EVENT_EXPRESSION
            or env.get("REF") != REF_EXPRESSION
        ):
            problems.append(
                "the event and ref do not reach ci_changes only through env: EVENT, REF"
            )
    if not runners:
        problems.append("no step of `changes` runs ci_changes")
    if changes.get("outputs", {}).get("base_ref") != "${{ steps.select.outputs.base_ref }}":
        problems.append("the `changes` job does not output base_ref from the select step")
    return problems


def _vitest_problems(vitest: Data | None) -> list[str]:
    if vitest is None:
        return ["there is no `vitest` job"]
    problems: list[str] = []
    if not any(step.get("with", {}).get("fetch-depth") == 0 for step in _checkouts(vitest)):
        problems.append("the `vitest` checkout does not set fetch-depth: 0")
    listing = [step for step in _steps(vitest) if "vitest list" in str(step.get("run", ""))]
    if not listing:
        problems.append("no step of `vitest` lists the changed tests")
    for step in listing:
        env = cast("Data", step.get("env", {}))
        if "${{" in step["run"] or env.get("BASE_REF") != BASE_REF_EXPRESSION:
            problems.append(
                "the base ref does not reach the vitest listing only through env: BASE_REF"
            )
    return problems


def _triggers(workflow: Data) -> Data:
    """The `on:` mapping; YAML 1.1 reads the key `on` as the boolean `True`."""
    loaded = cast("dict[object, Data]", workflow)
    return loaded.get("on") or loaded.get(True) or {}


def _trigger_problems(workflow: Data) -> list[str]:
    """What starts the workflow, and that no command names the pull request's parent commit:
    only `ci_changes` does, which keeps the base one value the `changes` job prints."""
    problems: list[str] = []
    triggers = _triggers(workflow)
    if cast("Data", triggers.get("push", {})).get("branches") != PUSH_BRANCHES:
        problems.append(f"`on.push.branches` is not {PUSH_BRANCHES}")
    if "pull_request" not in triggers or triggers["pull_request"] is not None:
        problems.append("`on.pull_request` is not the bare trigger")
    for job_id, commands in _runs(workflow).items():
        problems.extend(
            f"job {job_id!r} names HEAD^1 in a run; the base is `base_ref`: {command}"
            for command in commands
            if "HEAD^1" in command
        )
    return problems


def _coverage_problems(jobs: Data) -> list[str]:
    problems: list[str] = []
    for job_id, job in jobs.items():
        for step in _steps(job):
            if str(step.get("uses", "")).startswith("actions/upload-artifact") and str(
                step.get("with", {}).get("name", "")
            ).startswith("coverage"):
                if step["with"].get("include-hidden-files") is not True:
                    problems.append(
                        f"job {job_id!r}: coverage upload {step['with']['name']!r} "
                        "lacks include-hidden-files: true"
                    )
    cov_steps = _steps(jobs.get(COVERAGE, {"steps": []}))
    combine = [step for step in cov_steps if step.get("id") == "combine"]
    if not combine or combine[0].get("continue-on-error") is not True:
        problems.append("the coverage `combine` step is missing or lacks continue-on-error: true")
    failure = [step for step in cov_steps if "exit 1" in str(step.get("run", ""))]
    if not failure or "steps.combine.outcome" not in str(failure[0].get("if", "")):
        problems.append("the coverage failure step does not read steps.combine.outcome")
    elif "no pytest data from" not in failure[0]["run"] or not failure[0].get("env", {}).get(
        "MATRIX"
    ):
        problems.append("the coverage failure step does not name the shard count from MATRIX")
    comment = [step for step in cov_steps if "gh api" in str(step.get("run", ""))]
    if not comment:
        problems.append("the coverage job has no comment step")
    for step in comment:
        if step.get("if") != FORK_GUARD:
            problems.append("the comment step is not guarded by the fork check")
        if step.get("continue-on-error") is not True:
            problems.append("the comment step lacks continue-on-error: true")
        if step.get("env", {}).get("MARKER") != MARKER:
            problems.append("the comment step's MARKER is not ci_coverage's MARKER")
    return problems


def _generate_problems(
    generate: str,
    runs: dict[str, list[str]],
    gated: set[str],
    checks: dict[str, str],
    ci_only: dict[str, str],
    ci_forms: dict[str, str],
) -> list[str]:
    """What keeps `docs.generate` from being one step of one gated job and nothing else."""
    problems: list[str] = []
    holders = [job for job, commands in runs.items() if generate in commands]
    if len(holders) != 1:
        problems.append(f"docs.generate ({generate}) is a step of {len(holders)} jobs, not 1")
    elif holders[0] not in gated:
        problems.append(f"docs.generate runs in job {holders[0]!r}, which ci: does not gate")
    if generate in ci_only:
        problems.append(f"docs.generate ({generate}) is also in CI_ONLY")
    if generate in ci_forms.values():
        problems.append(f"docs.generate ({generate}) is also in CI_FORMS")
    problems.extend(
        f"docs.generate ({generate}) is also in checks {name!r}"
        for name, command in checks.items()
        if command == generate
    )
    return problems


def stack_ci_problems(
    stack: Data, workflow: Data, ci_only: dict[str, str], ci_forms: dict[str, str]
) -> list[str]:
    """What keeps `stack` and `workflow` from being one list of checks."""
    problems: list[str] = []
    runs = _runs(workflow)
    checks: dict[str, str] = stack["checks"]
    setup: dict[str, str] = stack["setup"]
    ci_names: list[str] = stack.get("ci", [])
    docs: Data | None = stack.get("docs")
    generate: str | None = docs["generate"] if docs is not None else None
    if not ci_names:
        return ["stack.yaml has no `ci:`"]

    for name in ci_names:
        if name not in runs:
            problems.append(f"ci: names {name!r}, which is not a job of ci.yml")
    gated = _closure(workflow, ci_names)

    for name, command in checks.items():
        holders = [job for job, commands in runs.items() if command in commands]
        form = ci_forms.get(name)
        if holders and form is not None:
            problems.append(f"check {name!r} is a step of a job and has a CI_FORMS entry")
        elif form is not None:
            if not any(form in runs[job] for job in gated if job in runs):
                problems.append(f"check {name!r}: CI_FORMS command ({form}) is run by no gated job")
        elif len(holders) != 1:
            problems.append(f"check {name!r} ({command}) is a step of {len(holders)} jobs, not 1")
        elif holders[0] not in gated:
            problems.append(f"check {name!r} runs in job {holders[0]!r}, which ci: does not gate")
    problems.extend(
        f"CI_FORMS names {name!r}, which is not a check" for name in ci_forms if name not in checks
    )

    for command in ci_only:
        holders = [job for job, commands in runs.items() if command in commands]
        if not holders:
            problems.append(f"CI_ONLY command ({command}) is run by no job of ci.yml")
        elif not any(job in gated for job in holders):
            problems.append(f"CI_ONLY command ({command}) is not in a gated job")

    known = {*setup.values(), *checks.values(), *ci_only, *ci_forms.values()}
    if generate is not None:
        known.add(generate)
        problems.extend(_generate_problems(generate, runs, gated, checks, ci_only, ci_forms))
    for job, commands in runs.items():
        problems.extend(
            f"job {job!r} runs an unknown step: {command}"
            for command in commands
            if command not in known
        )
    for job_id in workflow["jobs"]:
        if job_id not in gated:
            problems.append(f"job {job_id!r} is not in the needs closure of ci:")

    problems.extend(_structure_problems(workflow, ci_names, checks))
    problems.extend(
        f"output {name!r} is read but no producer emits it"
        for name in sorted(_output_references(workflow) - OUTPUT_NAMES)
    )
    changes = cast("Data", workflow["jobs"].get("changes", {}))
    problems.extend(
        f"`changes` declares output {name!r}, which ci_changes does not emit"
        for name in cast("Data", changes.get("outputs", {}))
        if name not in OUTPUT_NAMES
    )
    return problems


def _forms_for(stack: Data) -> dict[str, str]:
    return {name: command for name, command in CI_FORMS.items() if name in stack["checks"]}


def _problems(
    workflow: Data, stack: Data = STACK, forms: dict[str, str] | None = None
) -> list[str]:
    return stack_ci_problems(stack, workflow, CI_ONLY, CI_FORMS if forms is None else forms)


def _mutated() -> Data:
    """A deep copy of the real workflow, for a test to break one rule in."""
    return copy.deepcopy(WORKFLOW)


def test_ci_yml_and_stack_yaml_are_one_list() -> None:
    assert _problems(WORKFLOW) == []


def test_the_gated_jobs_are_the_needs_closure_of_ci_ok() -> None:
    assert STACK["ci"] == ["ci-ok"]
    assert _closure(WORKFLOW, STACK["ci"]) == set(WORKFLOW["jobs"])


def test_ci_ok_needs_every_other_job_and_runs_always() -> None:
    ci_ok = WORKFLOW["jobs"]["ci-ok"]
    assert sorted(_needs(ci_ok)) == sorted(job for job in WORKFLOW["jobs"] if job != "ci-ok")
    assert ci_ok["if"] == "always()"


def test_a_missing_need_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["ci-ok"]["needs"].remove("e2e")
    problems = _problems(workflow)
    assert any("'ci-ok' needs" in p and "not every other job" in p for p in problems)
    assert "job 'e2e' is not in the needs closure of ci:" in problems


def test_a_ci_ok_without_always_is_refused() -> None:
    workflow = _mutated()
    del workflow["jobs"]["ci-ok"]["if"]
    assert "'ci-ok' does not carry `if: always()`" in _problems(workflow)


@pytest.mark.parametrize("job", ["checks", "web", "changes", "docs"])
def test_a_skip_if_on_an_always_on_job_is_refused(job: str) -> None:
    workflow = _mutated()
    workflow["jobs"][job]["if"] = "needs.changes.outputs.pytest == 'true'"
    problems = _problems(workflow)
    assert any(f"job {job!r} carries a skip `if:`" in p for p in problems)


def test_a_suite_whose_if_is_not_its_flag_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["e2e-shard"]["if"] = "needs.changes.outputs.vitest == 'true'"
    expected = "job 'e2e-shard' `if:` is not `needs.changes.outputs.e2e == 'true'`"
    assert expected in _problems(workflow)


def test_the_concurrency_and_permission_keys_are_pinned() -> None:
    workflow = _mutated()
    workflow["concurrency"]["cancel-in-progress"] = True
    workflow["permissions"] = {"contents": "write"}
    problems = _problems(workflow)
    assert any(p.startswith("concurrency is not") for p in problems)
    assert "the workflow's permissions are not exactly `contents: read`" in problems


def test_pull_requests_write_on_another_job_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["checks"]["permissions"] = {"pull-requests": "write"}
    problems = _problems(workflow)
    assert "job 'checks' holds pull-requests: write; only 'coverage' may" in problems


def test_the_changes_checkout_without_full_depth_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["changes"]["steps"][0]["with"]["fetch-depth"] = 2
    assert "the `changes` checkout does not set fetch-depth: 0" in _problems(workflow)
    del workflow["jobs"]["changes"]["steps"][0]["with"]
    assert "the `changes` checkout does not set fetch-depth: 0" in _problems(workflow)


def test_the_event_or_ref_inside_run_instead_of_env_is_refused() -> None:
    message = "the event and ref do not reach ci_changes only through env: EVENT, REF"
    workflow = _mutated()
    step = workflow["jobs"]["changes"]["steps"][-1]
    step["run"] = 'uv run --no-project python -m scripts.ci_changes "${{ github.event_name }}"'
    assert message in _problems(workflow)

    workflow = _mutated()
    del workflow["jobs"]["changes"]["steps"][-1]["env"]["REF"]
    assert message in _problems(workflow)

    workflow = _mutated()
    workflow["jobs"]["changes"]["steps"][-1]["env"]["EVENT"] = "push"
    assert message in _problems(workflow)


def test_a_changes_job_without_the_base_ref_output_is_refused() -> None:
    workflow = _mutated()
    del workflow["jobs"]["changes"]["outputs"]["base_ref"]
    problems = _problems(workflow)
    assert "the `changes` job does not output base_ref from the select step" in problems


def test_the_vitest_checkout_without_full_depth_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["vitest"]["steps"][0]["with"]["fetch-depth"] = 2
    assert "the `vitest` checkout does not set fetch-depth: 0" in _problems(workflow)


def test_the_base_ref_inside_the_vitest_run_instead_of_env_is_refused() -> None:
    message = "the base ref does not reach the vitest listing only through env: BASE_REF"
    workflow = _mutated()
    step = next(s for s in workflow["jobs"]["vitest"]["steps"] if "vitest list" in s.get("run", ""))
    step["run"] = step["run"].replace("$BASE_REF", BASE_REF_EXPRESSION)
    assert message in _problems(workflow)

    workflow = _mutated()
    step = next(s for s in workflow["jobs"]["vitest"]["steps"] if "vitest list" in s.get("run", ""))
    del step["env"]
    assert message in _problems(workflow)


def test_head_parent_back_in_a_run_is_refused() -> None:
    workflow = _mutated()
    step = next(s for s in workflow["jobs"]["vitest"]["steps"] if "vitest list" in s.get("run", ""))
    step["run"] = step["run"].replace('"$BASE_REF"', "HEAD^1")
    assert any(
        p.startswith("job 'vitest' names HEAD^1 in a run; the base is `base_ref`:")
        for p in _problems(workflow)
    )


def test_a_push_trigger_without_agentic_ci_is_refused() -> None:
    message = f"`on.push.branches` is not {PUSH_BRANCHES}"
    workflow = _mutated()
    _triggers(workflow)["push"]["branches"] = ["master"]
    assert message in _problems(workflow)
    _triggers(workflow)["push"]["branches"] = ["agentic-ci/**", "master"]
    assert message in _problems(workflow)


def test_a_pull_request_trigger_with_a_filter_is_refused() -> None:
    workflow = _mutated()
    _triggers(workflow)["pull_request"] = {"branches": ["master"]}
    assert "`on.pull_request` is not the bare trigger" in _problems(workflow)
    del _triggers(workflow)["pull_request"]
    assert "`on.pull_request` is not the bare trigger" in _problems(workflow)


def test_the_real_workflow_triggers_on_master_agentic_ci_and_pull_requests() -> None:
    triggers = _triggers(WORKFLOW)
    assert triggers["push"]["branches"] == ["master", "agentic-ci/**"]
    assert triggers["pull_request"] is None


# --- the cancellation rule, evaluated from the workflow's own expression --------------------------

_TOKENS = re.compile(r"\s*(?:(\|\||&&|==|\(|\)|,)|'([^']*)'|([A-Za-z_][\w.]*))")


def _tokenize(text: str) -> list[tuple[str, str]]:
    """`(kind, text)` pairs: `op`, `str` or `name`. Anything else is not in the supported subset."""
    tokens: list[tuple[str, str]] = []
    position = 0
    while text[position:].strip():
        found = _TOKENS.match(text, position)
        if found is None:
            raise ValueError(f"unsupported expression text at {text[position:]!r}")
        operator, literal, name = found.groups()
        if operator is not None:
            tokens.append(("op", operator))
        elif literal is not None:
            tokens.append(("str", literal))
        else:
            tokens.append(("name", name))
        position = found.end()
    return tokens


class _Expression:
    """`||`, `&&`, `==`, parentheses, `startsWith(a, b)`, single-quoted strings and the contexts
    `github.event_name` and `github.ref`; the grammar is one level per operator, loosest first."""

    def __init__(self, text: str, context: dict[str, str]) -> None:
        self.tokens = _tokenize(text)
        self.context = context
        self.position = 0

    def evaluate(self) -> bool | str:
        value = self._or()
        if self.position != len(self.tokens):
            raise ValueError(f"unexpected token {self.tokens[self.position]}")
        return value

    def _peek(self) -> tuple[str, str] | None:
        return self.tokens[self.position] if self.position < len(self.tokens) else None

    def _take(self, text: str) -> bool:
        if self._peek() == ("op", text):
            self.position += 1
            return True
        return False

    def _expect(self, text: str) -> None:
        if not self._take(text):
            raise ValueError(f"expected {text!r} at token {self.position}")

    def _or(self) -> bool | str:
        value = self._and()
        while self._take("||"):
            right = self._and()
            value = value or right
        return value

    def _and(self) -> bool | str:
        value = self._equal()
        while self._take("&&"):
            right = self._equal()
            value = value and right
        return value

    def _equal(self) -> bool | str:
        value = self._primary()
        while self._take("=="):
            value = value == self._primary()
        return value

    def _primary(self) -> bool | str:
        token = self._peek()
        if token is None:
            raise ValueError("the expression ends early")
        self.position += 1
        kind, text = token
        if (kind, text) == ("op", "("):
            value = self._or()
            self._expect(")")
            return value
        if kind == "str":
            return text
        if kind == "name" and text == "startsWith":
            self._expect("(")
            subject = self._or()
            self._expect(",")
            prefix = self._or()
            self._expect(")")
            return (
                isinstance(subject, str) and isinstance(prefix, str) and subject.startswith(prefix)
            )
        if kind == "name" and text in self.context:
            return self.context[text]
        raise ValueError(f"unsupported token {token}")


def _cancels(workflow: Data, event: str, ref: str) -> bool:
    raw = cast("str", workflow["concurrency"]["cancel-in-progress"])
    inner = re.fullmatch(r"\$\{\{(.*)\}\}", raw.strip(), re.DOTALL)
    assert inner is not None, raw
    context = {"github.event_name": event, "github.ref": ref}
    return _Expression(inner.group(1), context).evaluate() is True


@pytest.mark.parametrize(
    ("event", "ref", "cancels"),
    [
        ("push", "refs/heads/master", False),
        ("pull_request", "refs/pull/1/merge", True),
        ("push", "refs/heads/agentic-ci/GH-1", True),
        ("push", "refs/heads/agentic-ci-x", False),
        ("push", "refs/tags/agentic-ci/x", False),
    ],
)
def test_a_newer_run_cancels_only_for_a_pull_request_or_an_agentic_ci_push(
    event: str, ref: str, cancels: bool
) -> None:
    assert _cancels(WORKFLOW, event, ref) is cancels


def test_the_evaluator_refuses_an_expression_outside_its_subset() -> None:
    for text in ("github.actor == 'x'", "contains(github.ref, 'x')", "github.ref != 'x'", "1 == 1"):
        with pytest.raises(ValueError):
            _Expression(text, {"github.event_name": "push", "github.ref": "r"}).evaluate()


def test_a_cancellation_rule_that_also_cancels_master_is_refused_by_the_evaluator() -> None:
    workflow = _mutated()
    workflow["concurrency"]["cancel-in-progress"] = "${{ github.event_name == 'push' }}"
    assert _cancels(workflow, "push", "refs/heads/master") is True
    assert any(p.startswith("concurrency is not") for p in _problems(workflow))


def test_a_comment_step_without_the_fork_guard_or_continue_on_error_is_refused() -> None:
    workflow = _mutated()
    for step in workflow["jobs"]["coverage"]["steps"]:
        if "gh api" in str(step.get("run", "")):
            del step["if"]
            del step["continue-on-error"]
    problems = _problems(workflow)
    assert "the comment step is not guarded by the fork check" in problems
    assert "the comment step lacks continue-on-error: true" in problems


def test_a_coverage_upload_without_include_hidden_files_is_refused() -> None:
    workflow = _mutated()
    for step in workflow["jobs"]["pytest"]["steps"]:
        if "upload-artifact" in str(step.get("uses", "")):
            del step["with"]["include-hidden-files"]
    problems = _problems(workflow)
    assert any("coverage upload" in p and "include-hidden-files" in p for p in problems)


@pytest.mark.parametrize("job", ["vitest", "e2e-shard"])
def test_a_browser_suite_without_the_chromium_install_is_refused(job: str) -> None:
    workflow = _mutated()
    workflow["jobs"][job]["steps"] = [
        step for step in workflow["jobs"][job]["steps"] if step.get("run") != CHROMIUM_RUN
    ]
    assert f"job {job!r} runs a browser suite without installing Chromium first" in _problems(
        workflow
    )


def test_an_expression_function_github_does_not_have_is_refused() -> None:
    workflow = _mutated()
    step = workflow["jobs"]["coverage"]["steps"][-1]
    step["env"] = {"SHARDS": "${{ length(fromJSON(needs.changes.outputs.pytest_matrix).include) }}"}
    problems = _problems(workflow)
    assert "expression function 'length' is not one GitHub Actions documents" in problems


def test_an_expression_function_in_an_if_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["pytest"]["steps"][0]["if"] = "length(github.ref) > 3"
    assert "expression function 'length' is not one GitHub Actions documents" in _problems(workflow)


def test_a_coverage_combine_without_continue_on_error_is_refused() -> None:
    workflow = _mutated()
    for step in workflow["jobs"]["coverage"]["steps"]:
        if step.get("id") == "combine":
            del step["continue-on-error"]
    assert any("`combine` step" in p for p in _problems(workflow))


def test_a_coverage_failure_step_that_does_not_read_the_combine_outcome_is_refused() -> None:
    workflow = _mutated()
    for step in workflow["jobs"]["coverage"]["steps"]:
        if "exit 1" in str(step.get("run", "")):
            step["if"] = "needs.changes.outputs.pytest == 'true'"
    assert "the coverage failure step does not read steps.combine.outcome" in _problems(workflow)


def test_a_coverage_failure_step_that_does_not_count_the_shards_is_refused() -> None:
    workflow = _mutated()
    for step in workflow["jobs"]["coverage"]["steps"]:
        if "exit 1" in str(step.get("run", "")):
            del step["env"]["MATRIX"]
    assert "the coverage failure step does not name the shard count from MATRIX" in _problems(
        workflow
    )


def test_an_output_name_no_producer_emits_is_refused() -> None:
    workflow = _mutated()
    step = workflow["jobs"]["e2e-shard"]["steps"][-2]
    step["env"]["E2E_ARGS"] = "${{ needs.changes.outputs.e2e_arg }}"
    assert "output 'e2e_arg' is read but no producer emits it" in _problems(workflow)


def test_an_output_declared_by_changes_that_the_script_does_not_emit_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["changes"]["outputs"]["bogus"] = "${{ steps.select.outputs.bogus }}"
    assert "`changes` declares output 'bogus', which ci_changes does not emit" in _problems(
        workflow
    )


def test_every_output_the_workflow_reads_is_one_a_producer_emits() -> None:
    assert _output_references(WORKFLOW) <= OUTPUT_NAMES
    assert {"pytest", "e2e_matrix", "args"} <= _output_references(WORKFLOW)


def test_an_untied_ci_form_is_refused() -> None:
    forms = {**CI_FORMS, "web-e2e": "npm --prefix web run e2e -- --shard=1/1"}
    problems = _problems(WORKFLOW, forms=forms)
    assert (
        "check 'web-e2e': CI_FORMS command (npm --prefix web run e2e -- --shard=1/1) "
        "is run by no gated job" in problems
    )


def test_a_check_that_is_both_a_step_and_a_ci_form_is_refused() -> None:
    forms = {**CI_FORMS, "types": "uv run --no-project mypy app tests scripts"}
    problems = _problems(WORKFLOW, forms=forms)
    assert "check 'types' is a step of a job and has a CI_FORMS entry" in problems


def test_a_ci_form_key_that_is_not_a_check_is_refused() -> None:
    forms = {**CI_FORMS, "web-docs": VITEST_RUN}
    assert "CI_FORMS names 'web-docs', which is not a check" in _problems(WORKFLOW, forms=forms)


def test_a_check_with_no_step_and_no_ci_form_is_refused() -> None:
    forms = {name: command for name, command in CI_FORMS.items() if name != "tests-fast"}
    problems = _problems(WORKFLOW, forms=forms)
    assert any("check 'tests-fast'" in p and "0 jobs" in p for p in problems)


def test_a_check_run_by_two_jobs_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["e2e-shard"]["steps"].append({"run": STACK["checks"]["types"]})
    problems = _problems(workflow)
    assert any("'types'" in p and "2 jobs" in p for p in problems)


def test_a_check_that_differs_from_its_ci_step_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["types"] = "uv run --no-project mypy app tests"
    problems = _problems(WORKFLOW, stack, _forms_for(stack))
    assert any("'types'" in p for p in problems)
    assert any("mypy app tests scripts" in p and "unknown step" in p for p in problems)


def test_a_ci_name_that_is_not_a_job_is_refused() -> None:
    stack = {**copy.deepcopy(STACK), "ci": ["ci-ok", "test"]}
    problems = _problems(WORKFLOW, stack)
    assert "ci: names 'test', which is not a job of ci.yml" in problems


def test_a_check_in_a_job_outside_the_closure_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["ci-ok"]["needs"].remove("web")
    problems = _problems(workflow)
    assert any("'web'" in p and "closure" in p for p in problems)
    assert any("check 'web-types' runs in job 'web'" in p for p in problems)


def test_a_ci_only_entry_no_job_runs_is_refused() -> None:
    ci_only = {**CI_ONLY, "npm --prefix web run storybook": "a step nobody runs"}
    problems = stack_ci_problems(STACK, WORKFLOW, ci_only, CI_FORMS)
    assert problems == [
        "CI_ONLY command (npm --prefix web run storybook) is run by no job of ci.yml"
    ]


def test_an_unknown_step_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["checks"]["steps"].append({"run": "make everything-green"})
    assert _problems(workflow) == ["job 'checks' runs an unknown step: make everything-green"]


GENERATE = "uv run --no-project python -m scripts.docs.generate"
DOCS_OWNED = ("docs/architecture/generated", "docs/api")


def _without_generate_step(workflow: Data) -> Data:
    copied = copy.deepcopy(workflow)
    for body in copied["jobs"].values():
        body["steps"] = [step for step in body["steps"] if step.get("run", "").strip() != GENERATE]
    return copied


def _generate_messages(problems: list[str]) -> list[str]:
    return [problem for problem in problems if problem.startswith("docs.generate")]


def test_docs_generate_is_declared_and_is_a_step_of_the_docs_job_only() -> None:
    assert STACK["docs"]["generate"] == GENERATE
    assert [job for job, commands in _runs(WORKFLOW).items() if GENERATE in commands] == ["docs"]


def test_a_docs_generate_no_job_runs_is_refused() -> None:
    assert _problems(_without_generate_step(WORKFLOW)) == [
        f"docs.generate ({GENERATE}) is a step of 0 jobs, not 1"
    ]


def test_a_docs_generate_run_by_two_jobs_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["e2e-shard"]["steps"].append({"run": GENERATE})
    assert _problems(workflow) == [f"docs.generate ({GENERATE}) is a step of 2 jobs, not 1"]


def test_a_docs_generate_in_a_job_outside_the_closure_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["ci-ok"]["needs"].remove("docs")
    assert _generate_messages(_problems(workflow)) == [
        "docs.generate runs in job 'docs', which ci: does not gate"
    ]


def test_a_docs_generate_still_listed_in_ci_only_is_refused() -> None:
    ci_only = {**CI_ONLY, GENERATE: "the docs generator"}
    assert stack_ci_problems(STACK, WORKFLOW, ci_only, CI_FORMS) == [
        f"docs.generate ({GENERATE}) is also in CI_ONLY"
    ]


def test_a_docs_generate_that_is_also_a_ci_form_is_refused() -> None:
    forms = {**CI_FORMS, "tests": GENERATE}
    assert f"docs.generate ({GENERATE}) is also in CI_FORMS" in _problems(WORKFLOW, forms=forms)


def test_a_docs_generate_that_is_also_a_check_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["checks"]["gen"] = GENERATE
    problems = _problems(WORKFLOW, stack, _forms_for(stack))
    assert f"docs.generate ({GENERATE}) is also in checks 'gen'" in problems


def test_without_a_docs_block_the_generate_command_is_an_unknown_step() -> None:
    stack = {key: value for key, value in copy.deepcopy(STACK).items() if key != "docs"}
    assert _problems(WORKFLOW, stack) == [f"job 'docs' runs an unknown step: {GENERATE}"]


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


def test_the_verdict_command_is_ci_only_and_runs_in_ci_ok() -> None:
    assert VERDICT_RUN in CI_ONLY
    assert VERDICT_RUN in _runs(WORKFLOW)["ci-ok"]


def test_the_comment_marker_is_the_one_ci_coverage_writes() -> None:
    step = next(s for s in _steps(WORKFLOW["jobs"]["coverage"]) if "gh api" in str(s.get("run")))
    assert step["env"]["MARKER"] == MARKER


@pytest.mark.parametrize("command", sorted(CI_ONLY))
def test_every_ci_only_entry_has_a_reason(command: str) -> None:
    assert CI_ONLY[command].strip()


# --- the e2e aggregator, the judges and ci_covers -------------------------------------------------


def _gate_messages(problems: list[str]) -> list[str]:
    return [problem for problem in problems if f"job {E2E_GATE!r}" in problem]


def test_the_e2e_aggregator_is_pinned_as_the_plan_wrote_it() -> None:
    gate = WORKFLOW["jobs"][E2E_GATE]
    assert gate["if"] == E2E_GATE_IF
    assert _needs(gate) == ["changes", E2E_SHARD]
    assert "strategy" not in gate
    assert gate["steps"] == [{"env": {"RESULT": E2E_GATE_RESULT}, "run": E2E_GATE_RUN}]
    assert "strategy" in WORKFLOW["jobs"][E2E_SHARD]


def test_an_aggregator_with_another_if_or_needs_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"][E2E_GATE]["if"] = "needs.changes.outputs.e2e == 'true'"
    workflow["jobs"][E2E_GATE]["needs"] = ["changes"]
    messages = _gate_messages(_problems(workflow))
    assert f"job 'e2e' `if:` is not `{E2E_GATE_IF}`" in messages
    assert "job 'e2e' needs ['changes'], not ['changes', 'e2e-shard']" in messages


def test_an_aggregator_with_a_matrix_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"][E2E_GATE]["strategy"] = {"matrix": {"shard": [1]}}
    assert "job 'e2e' has a strategy; it must be one check-run" in _problems(workflow)


def test_an_aggregator_with_a_checkout_or_an_extra_step_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"][E2E_GATE]["steps"].insert(0, {"uses": "actions/checkout@v7"})
    messages = _gate_messages(_problems(workflow))
    assert "job 'e2e' has 2 steps, not 1" in messages
    assert "job 'e2e' runs a `uses:` step (actions/checkout@v7)" in messages


def test_an_aggregator_that_runs_uv_or_a_check_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"][E2E_GATE]["steps"][0]["run"] = STACK["checks"]["lint"]
    messages = _gate_messages(_problems(workflow))
    assert f"job 'e2e' step is not `{E2E_GATE_RUN}`" in messages
    assert f"job 'e2e' runs `uv` or a check command: {STACK['checks']['lint']}" in messages


def test_an_aggregator_reading_another_result_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"][E2E_GATE]["steps"][0]["env"]["RESULT"] = "${{ needs.changes.result }}"
    expected = f"job 'e2e' env is not exactly RESULT: {E2E_GATE_RESULT}"
    assert expected in _problems(workflow)


def test_an_always_on_a_job_other_than_the_aggregator_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"][E2E_SHARD]["if"] = "always()"
    problems = _problems(workflow)
    assert "job 'e2e-shard' carries `always()` in its `if:` (always())" in problems
    assert not any(problem.startswith("job 'e2e' carries") for problem in problems)


def test_every_job_ci_ok_needs_has_a_judge_or_is_changes() -> None:
    judged = {*SUITES, *ALWAYS_JOBS, *WARN_JOBS, CHANGES}
    assert set(_needs(WORKFLOW["jobs"]["ci-ok"])) <= judged


def test_a_ci_ok_need_with_no_judge_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["ci-ok"]["needs"].append("deploy-preview")
    problems = _problems(workflow)
    assert "ci-ok needs 'deploy-preview', which scripts/ci_verdict.py does not judge" in problems


def ci_covers_problems(stack: Data, workflow: Data) -> list[str]:
    """What keeps `ci_covers.web-e2e` from naming a job that covers it."""
    entry = cast("Data", stack.get("ci_covers", {})).get("web-e2e")
    if entry is None:
        return ["ci_covers has no web-e2e entry"]
    problems: list[str] = []
    if "web-e2e" not in stack["checks"]:
        problems.append("ci_covers.web-e2e is not in checks")
    if entry.get("job") != E2E_GATE:
        problems.append(f"ci_covers.web-e2e.job is {entry.get('job')!r}, not {E2E_GATE!r}")
    if E2E_GATE not in _needs(workflow["jobs"]["ci-ok"]):
        problems.append(f"{E2E_GATE!r} is not in ci-ok.needs")
    problems.extend(_failed_regex_problems(str(entry.get("failed", ""))))
    return problems


SHOULD_MATCH = ("  \u2718  12 [mobile] \u203a sales.spec.ts:40:5 \u203a x", "  3 failed")
SHOULD_NOT_MATCH = (
    "  \u2713  217 [mobile] \u203a x (1.2s)",
    "  217 passed (25.3m)",
    "  1 flaky",
)


# A group with an unbounded repeat inside it that is itself repeated: GH-453's refused shape.
NESTED_REPEAT = re.compile(r"\([^()]*[+*][^()]*\)[+*{]")


def _failed_regex_problems(pattern: str) -> list[str]:
    if len(pattern) > 200:
        return [f"ci_covers.web-e2e.failed is {len(pattern)} characters, over 200"]
    if NESTED_REPEAT.search(pattern):
        return ["ci_covers.web-e2e.failed has a nested unbounded repetition"]
    try:
        compiled = re.compile(pattern)
    except re.error as error:
        return [f"ci_covers.web-e2e.failed does not compile: {error}"]
    problems = [
        f"ci_covers.web-e2e.failed does not match {line!r}"
        for line in SHOULD_MATCH
        if compiled.search(line) is None
    ]
    problems.extend(
        f"ci_covers.web-e2e.failed matches {line!r}"
        for line in SHOULD_NOT_MATCH
        if compiled.search(line) is not None
    )
    return problems


def test_ci_covers_names_the_aggregator_and_its_regex_separates_failures() -> None:
    assert ci_covers_problems(STACK, WORKFLOW) == []


def test_ci_covers_is_the_last_key_of_stack_yaml() -> None:
    assert list(STACK)[-1] == "ci_covers"
    assert STACK["ci_covers"]["web-e2e"]["job"] == E2E_GATE


def test_a_ci_covers_job_that_is_the_matrix_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    stack["ci_covers"]["web-e2e"]["job"] = E2E_SHARD
    assert ci_covers_problems(stack, WORKFLOW) == [
        "ci_covers.web-e2e.job is 'e2e-shard', not 'e2e'"
    ]


def test_a_ci_covers_for_a_check_that_is_not_declared_is_refused() -> None:
    stack = copy.deepcopy(STACK)
    del stack["checks"]["web-e2e"]
    assert "ci_covers.web-e2e is not in checks" in ci_covers_problems(stack, WORKFLOW)


def test_a_ci_covers_job_outside_ci_ok_needs_is_refused() -> None:
    workflow = _mutated()
    workflow["jobs"]["ci-ok"]["needs"].remove(E2E_GATE)
    assert "'e2e' is not in ci-ok.needs" in ci_covers_problems(STACK, workflow)


def test_a_missing_ci_covers_is_refused() -> None:
    stack = {key: value for key, value in copy.deepcopy(STACK).items() if key != "ci_covers"}
    assert ci_covers_problems(stack, WORKFLOW) == ["ci_covers has no web-e2e entry"]


def test_a_failed_regex_over_200_characters_or_not_compiling_is_refused() -> None:
    assert _failed_regex_problems("x" * 201) == [
        "ci_covers.web-e2e.failed is 201 characters, over 200"
    ]
    [problem] = _failed_regex_problems("(unclosed")
    assert problem.startswith("ci_covers.web-e2e.failed does not compile: ")


def test_a_failed_regex_that_misses_a_failure_or_matches_a_pass_is_refused() -> None:
    assert "ci_covers.web-e2e.failed does not match '  3 failed'" in _failed_regex_problems(
        "\u2718"
    )
    assert "ci_covers.web-e2e.failed matches '  1 flaky'" in _failed_regex_problems(
        "\u2718|failed|flaky"
    )


def test_a_failed_regex_with_a_nested_unbounded_repetition_is_refused() -> None:
    expected = ["ci_covers.web-e2e.failed has a nested unbounded repetition"]
    assert _failed_regex_problems("(a+)+") == expected
    assert _failed_regex_problems("(x*y)*b") == expected
