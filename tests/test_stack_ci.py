"""Local checks and CI run one list (ADR-0054, amended by GH-476): the gated jobs of
`.github/workflows/ci.yml` are the `needs` closure of the job ids `ci:` names in
`.agentic/stack.yaml` (only `ci-ok`). Every check is either a `run:` step of exactly one gated job
or has a `CI_FORMS` entry whose command is a step of a gated job, never both; a `CI_FORMS` key
that is not a check, or a value no gated job runs, is refused. Every other `run:` step is a
`setup` command or a named `CI_ONLY` entry, and every `CI_ONLY` entry is run by some job.
`ci-ok` needs every other job and runs `if: always()`; the always-on jobs carry no skip `if:`;
the suites are skipped only by their `changes` flag; the workflow's permissions, concurrency,
fetch depth, fork guard, hidden-file uploads and output names are pinned.
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

# Commands that only CI runs, each with the reason it is not a local check.
CI_ONLY: dict[str, str] = {
    "npx --prefix web playwright install --with-deps chromium": (
        "the runner needs the root `--with-deps` form of `setup.web-browsers`"
    ),
    'uv run --no-project python -m scripts.ci_changes "$EVENT" >> "$GITHUB_OUTPUT"': (
        "the `changes` job: which suites the pull request affects (ADR-0064)"
    ),
    (
        "npx --prefix web vitest list --root web --changed=HEAD^1 --filesOnly > "
        '"$RUNNER_TEMP/vitest-listed.txt"'
    ): "vitest's own listing, run by the workflow so no script runs a node tool (ADR-0064 §6)",
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
SUITE_JOBS = ("pytest", "vitest", "e2e")
COVERAGE = "coverage"
OUTPUT_PREFIXES = ("needs.changes.outputs.", "steps.vitest-args.outputs.")
EXPECTED_CONCURRENCY = {
    "group": "ci-${{ github.workflow }}-${{ github.ref }}",
    "cancel-in-progress": "${{ github.event_name == 'pull_request' }}",
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
OUTPUT_NAMES = {line.split("=", 1)[0] for line in render(select(None, REPO_ROOT))} | {"args"}


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


def _structure_problems(workflow: Data, ci_names: list[str]) -> list[str]:
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
        expected = f"needs.changes.outputs.{job_id} == 'true'"
        if job_id in jobs and jobs[job_id].get("if") != expected:
            problems.append(f"job {job_id!r} `if:` is not `{expected}`")

    problems.extend(_changes_problems(jobs.get("changes")))
    problems.extend(_coverage_problems(jobs))
    problems.extend(_expression_problems(workflow))
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


def _changes_problems(changes: Data | None) -> list[str]:
    if changes is None:
        return ["there is no `changes` job"]
    problems: list[str] = []
    steps = _steps(changes)
    checkouts = [step for step in steps if str(step.get("uses", "")).startswith("actions/checkout")]
    if not any(step.get("with", {}).get("fetch-depth") == 2 for step in checkouts):
        problems.append("the `changes` checkout does not set fetch-depth: 2")
    runners = [step for step in steps if "ci_changes" in str(step.get("run", ""))]
    for step in runners:
        if "${{" in step["run"] or step.get("env", {}).get("EVENT") != "${{ github.event_name }}":
            problems.append("the event does not reach ci_changes only through env: EVENT")
    if not runners:
        problems.append("no step of `changes` runs ci_changes")
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


def stack_ci_problems(
    stack: Data, workflow: Data, ci_only: dict[str, str], ci_forms: dict[str, str]
) -> list[str]:
    """What keeps `stack` and `workflow` from being one list of checks."""
    problems: list[str] = []
    runs = _runs(workflow)
    checks: dict[str, str] = stack["checks"]
    setup: dict[str, str] = stack["setup"]
    ci_names: list[str] = stack.get("ci", [])
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
    for job, commands in runs.items():
        problems.extend(
            f"job {job!r} runs an unknown step: {command}"
            for command in commands
            if command not in known
        )
    for job_id in workflow["jobs"]:
        if job_id not in gated:
            problems.append(f"job {job_id!r} is not in the needs closure of ci:")

    problems.extend(_structure_problems(workflow, ci_names))
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
    workflow["jobs"]["e2e"]["if"] = "needs.changes.outputs.vitest == 'true'"
    expected = "job 'e2e' `if:` is not `needs.changes.outputs.e2e == 'true'`"
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


def test_the_changes_checkout_without_depth_two_is_refused() -> None:
    workflow = _mutated()
    del workflow["jobs"]["changes"]["steps"][0]["with"]
    assert "the `changes` checkout does not set fetch-depth: 2" in _problems(workflow)


def test_the_event_inside_run_instead_of_env_is_refused() -> None:
    workflow = _mutated()
    step = workflow["jobs"]["changes"]["steps"][-1]
    step["run"] = 'uv run --no-project python -m scripts.ci_changes "${{ github.event_name }}"'
    problems = _problems(workflow)
    assert "the event does not reach ci_changes only through env: EVENT" in problems


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
    workflow["jobs"]["e2e"]["steps"][-2]["env"]["E2E_ARGS"] = "${{ needs.changes.outputs.e2e_arg }}"
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
    workflow["jobs"]["e2e"]["steps"].append({"run": STACK["checks"]["types"]})
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


def test_the_verdict_command_is_ci_only_and_runs_in_ci_ok() -> None:
    assert VERDICT_RUN in CI_ONLY
    assert VERDICT_RUN in _runs(WORKFLOW)["ci-ok"]


def test_the_comment_marker_is_the_one_ci_coverage_writes() -> None:
    step = next(s for s in _steps(WORKFLOW["jobs"]["coverage"]) if "gh api" in str(s.get("run")))
    assert step["env"]["MARKER"] == MARKER


@pytest.mark.parametrize("command", sorted(CI_ONLY))
def test_every_ci_only_entry_has_a_reason(command: str) -> None:
    assert CI_ONLY[command].strip()
