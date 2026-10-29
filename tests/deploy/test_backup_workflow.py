"""`.github/workflows/backup.yml`'s own invariants: the daily ciphertext is pushed over SSH
to the private `apostrophe-backups` repository, one branch per copy, and copies older
than 30 days are pruned. This repository is public and anyone can download a public
repository's run artifacts, so the workflow keeps no artifact, no cache and no release.

Parsed with PyYAML into a plain `dict`, never read as text lines (`tests/test_no_secrets.py`
reads text; this reads structure). PyYAML parses YAML 1.1, where the bare key `on` loads as
the boolean `True`: it is read as `workflow.get(True, workflow.get("on"))`. Steps are found
by an anchor in their `uses`/`run` (and each anchor must match exactly one step), never by a
step's `name:`, which is a comment, not a seam.

Every checker returns a list of violations and is proven against a deliberately bad
fixture -- a one-field mutation of a minimal good `dict` built in Python, not a second YAML
file -- before it is trusted to pass over the real workflow. The same file checks
`deploy/github_known_hosts` and that the one backup URL is spelled the same everywhere.
"""

from __future__ import annotations

import base64
import binascii
import copy
import hashlib
import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKUP_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "backup.yml"
KNOWN_HOSTS = REPO_ROOT / "deploy" / "github_known_hosts"
README = REPO_ROOT / "deploy" / "README.md"
ADR = REPO_ROOT / "docs" / "adr" / "0017-deploying-render-turso-backups-and-the-restore-drill.md"
BACKUP_COPY_SCRIPT = REPO_ROOT / "scripts" / "backup_copy.py"

BACKUP_REPO = "git@github.com:GonzaloZevallos/apostrophe-backups.git"
GITHUB_ED25519_FINGERPRINT = "+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"
SECRETS = ("TURSO_DATABASE_URL", "TURSO_READONLY_TOKEN", "BACKUP_DEPLOY_KEY")
SIZE_LIMIT_BYTES = 94371840  # 90 MiB, under GitHub's 100 MB file limit

Workflow = dict[Any, Any]
Step = dict[str, Any]


def _steps(workflow: Workflow) -> list[Step]:
    steps = workflow.get("jobs", {}).get("backup", {}).get("steps", [])
    return steps if isinstance(steps, list) else []


def _run(step: Step) -> str:
    run = step.get("run", "")
    return run if isinstance(run, str) else ""


def _env(step: Step) -> dict[str, Any]:
    env = step.get("env", {})
    return env if isinstance(env, dict) else {}


def _logical_lines(run: str) -> list[str]:
    """The lines of a `run:` script, a trailing backslash joining a line to the next."""
    return run.replace("\\\n", " ").splitlines()


# -- Triggers, permissions, job guard, environment, concurrency --------------------------


def check_triggers(workflow: Workflow) -> list[str]:
    """Exactly `schedule` (the 07:00 UTC cron) and `workflow_dispatch`, nothing else."""
    triggers = workflow.get(True, workflow.get("on"))
    if not isinstance(triggers, dict):
        return [f"on must be a mapping of triggers, got {triggers!r}"]
    violations = []
    extra = sorted(str(key) for key in triggers if key not in ("schedule", "workflow_dispatch"))
    if extra:
        violations.append(f"triggers beyond schedule and workflow_dispatch: {extra}")
    if "workflow_dispatch" not in triggers:
        violations.append("workflow_dispatch trigger is missing")
    if triggers.get("schedule") != [{"cron": "0 7 * * *"}]:
        violations.append(
            f"schedule must be the cron '0 7 * * *', got {triggers.get('schedule')!r}"
        )
    return violations


def check_permissions(workflow: Workflow) -> list[str]:
    """Workflow-level `permissions` is exactly `{contents: read}`; the job sets none."""
    violations = []
    if workflow.get("permissions") != {"contents": "read"}:
        violations.append(
            "permissions must be exactly {'contents': 'read'}, "
            f"got {workflow.get('permissions')!r}"
        )
    if "permissions" in workflow.get("jobs", {}).get("backup", {}):
        violations.append("the backup job must not set its own permissions")
    return violations


def check_job_if(workflow: Workflow) -> list[str]:
    expected = "github.repository == 'GonzaloZevallos/apostrophe'"
    found = workflow.get("jobs", {}).get("backup", {}).get("if")
    return [] if found == expected else [f"job if must be {expected!r}, got {found!r}"]


def check_environment(workflow: Workflow) -> list[str]:
    found = workflow.get("jobs", {}).get("backup", {}).get("environment")
    return [] if found == "backup" else [f"job environment must be 'backup', got {found!r}"]


def check_concurrency(workflow: Workflow) -> list[str]:
    expected = {"group": "backup", "cancel-in-progress": False}
    found = workflow.get("concurrency")
    return [] if found == expected else [f"concurrency must be {expected!r}, got {found!r}"]


def check_persist_credentials(steps: list[Step]) -> list[str]:
    """Exactly one checkout step, and it leaves no token in the working tree's git config."""
    checkouts = [s for s in steps if str(s.get("uses", "")).startswith("actions/checkout@")]
    if len(checkouts) != 1:
        return [f"expected exactly one checkout step, found {len(checkouts)}"]
    with_block = checkouts[0].get("with", {})
    if not isinstance(with_block, dict) or with_block.get("persist-credentials") is not False:
        return ["checkout must set persist-credentials: false"]
    return []


def check_no_stored_artifacts(steps: list[Step]) -> list[str]:
    """No artifact, cache or release action, and no `gh` call: nothing of the copy is
    stored anywhere a public repository's readers could reach."""
    violations = []
    for i, step in enumerate(steps):
        uses = str(step.get("uses", ""))
        if re.search(r"artifact|actions/cache|release", uses):
            violations.append(f"step {i}: forbidden action {uses!r}")
        if re.search(r"\bgh\b", _run(step)):
            violations.append(f"step {i}: forbidden gh call")
    return violations


# -- Secrets -----------------------------------------------------------------------------


def check_secret_scope(workflow: Workflow) -> list[str]:
    """No workflow or job `env:`; each secret is read by exactly one step, in that step's
    own `env:` values (the match is on `secrets.<NAME>` expressions, never on env keys);
    none reaches a `uses:` step, a `run:` string or any other field; the deploy key's
    step carries nothing else in its `env:`; no secret outside the three is read."""
    violations = []
    if "env" in workflow:
        violations.append("workflow-level env is forbidden")
    if "env" in workflow.get("jobs", {}).get("backup", {}):
        violations.append("job-level env is forbidden")
    steps = _steps(workflow)
    for name in SECRETS:
        expression = re.compile(rf"secrets\.{name}\b")
        holders = [
            i
            for i, s in enumerate(steps)
            if any(expression.search(str(value)) for value in _env(s).values())
        ]
        if len(holders) != 1:
            violations.append(f"{name} must be in exactly one step's env, found {len(holders)}")
    for i, step in enumerate(steps):
        outside_env = {key: value for key, value in step.items() if key != "env"}
        if "secrets." in str(outside_env):
            violations.append(f"step {i}: a secret outside the step's env values")
        for value in _env(step).values():
            for found in re.findall(r"secrets\.(\w+)", str(value)):
                if found not in SECRETS:
                    violations.append(f"step {i}: unexpected secret {found}")
        if any("secrets.BACKUP_DEPLOY_KEY" in str(v) for v in _env(step).values()) and set(
            _env(step)
        ) != {"BACKUP_DEPLOY_KEY"}:
            violations.append(f"step {i}: the deploy key's step env holds anything else")
    return violations


def backup_copy_env_names(script: str) -> list[str]:
    """The environment names `scripts/backup_copy.py` reads, from its source."""
    return sorted(
        set(re.findall(r"_env\(\"([A-Z_]+)\"\)", script))
        | set(re.findall(r"os\.environ\.get\(\"([A-Z_]+)\"", script))
    )


def check_copy_env_names(steps: list[Step], names: list[str]) -> list[str]:
    """The copy step's `env:` keys include every name the script reads (the secrets are
    named `TURSO_*`, the script reads `APOSTROPHE_*`)."""
    copies = [s for s in steps if "scripts/backup_copy.py" in _run(s)]
    if len(copies) != 1:
        return [f"expected exactly one copy step, found {len(copies)}"]
    if not names:
        return ["no environment name found in the copy script"]
    missing = [name for name in names if name not in _env(copies[0])]
    return [f"the copy step lacks env key {name}" for name in missing]


# -- Shell hygiene -----------------------------------------------------------------------

_FORBIDDEN_PATTERNS = {
    "echo": r"\becho\b",
    "cat": r"\bcat\b",
    "printf": r"\bprintf\b",
    "tee": r"\btee\b",
    "curl": r"\bcurl\b",
    "print(": r"print\(",
    "set -x": r"\bset\s+-[A-Za-z]*x|\bxtrace\b|\bbash\s+-[A-Za-z]*x",
    "GIT_TRACE": r"GIT_TRACE\w*|GIT_CURL_VERBOSE",
    "ssh -v": r"\bssh\b[^\n]*\s-v+(?:\s|$)",
    "--verbose": r"--verbose\b",
    "credential in a URL": r"https?://[^\s/]*@",
    "bare printenv": r"\bprintenv\b(?!\s+[A-Za-z_])",
}


def check_forbidden_shell(steps: list[Step]) -> list[str]:
    """In each step's `run:` and `env:` (keys and values): none of the shell words that
    print, no tracing or verbose flag, no credential in a URL, no bare `printenv`. Whole
    words only, so `category` and `committee` pass."""
    violations = []
    for i, step in enumerate(steps):
        env_text = " ".join(f"{key}: {value}" for key, value in _env(step).items())
        text = _run(step) + "\n" + env_text
        for label, pattern in _FORBIDDEN_PATTERNS.items():
            if re.search(pattern, text):
                violations.append(f"step {i}: forbidden {label}")
    return violations


def check_no_force(steps: list[Step]) -> list[str]:
    """No force of any kind on a `git push`: `--force`, `--force-with-lease`, `-f`,
    `--mirror`, or a `+`-prefixed refspec."""
    violations = []
    for i, step in enumerate(steps):
        for line in _logical_lines(_run(step)):
            if not re.search(r"\bgit\b[^\n]*\bpush\b", line):
                continue
            if re.search(r"--force\b|--mirror\b|\s-[A-Za-z]*f\b", line):
                violations.append(f"step {i}: forced or mirrored push")
            if re.search(r"""(?:^|[\s"'])\+\S""", line):
                violations.append(f"step {i}: a + refspec")
    return violations


def check_pipefail(steps: list[Step]) -> list[str]:
    """Every `run:` with a pipe runs under `shell: bash` (which adds `-o pipefail`) or sets
    `set -o pipefail` itself, so a failed `ls-remote` never reads as an empty listing."""
    return [
        f"step {i}: a pipe without pipefail"
        for i, step in enumerate(steps)
        if "|" in _run(step) and step.get("shell") != "bash" and "set -o pipefail" not in _run(step)
    ]


# -- Pushes, deletes and the host key ----------------------------------------------------

_PUSH_TARGET = re.compile(r"\bgit\b[^\n]*?\bpush\s+(?:-{1,2}[\w-]+\s+)*(\S+)")
_LS_REMOTE_TARGET = re.compile(r"\bgit\b[^\n]*?\bls-remote\s+(?:-{1,2}[\w-]+\s+)*(\S+)")
_PRUNE_LISTING = re.compile(
    r"expired=\"\$\(git ls-remote --heads (\S+) \| uv run --no-project python "
    r"scripts/newest_backup\.py expired --now "
)


def check_pushes(steps: list[Step]) -> list[str]:
    """Every push, ls-remote and clone names the literal backup URL (never a variable);
    there is a push of `HEAD:refs/heads/…`; the delete is `--atomic`, guarded by a
    non-empty `$expired`, and `$expired` comes from `ls-remote` piped into
    `newest_backup.py expired`."""
    violations = []
    pushes = 0
    for i, step in enumerate(steps):
        run = _run(step)
        for line in _logical_lines(run):
            for kind, pattern in (("push", _PUSH_TARGET), ("ls-remote", _LS_REMOTE_TARGET)):
                found = pattern.search(line)
                if found and found.group(1).strip("\"'") != BACKUP_REPO:
                    violations.append(f"step {i}: {kind} target is not the literal backup URL")
            if re.search(r"\bgit\b[^\n]*\bclone\b", line) and BACKUP_REPO not in line:
                violations.append(f"step {i}: clone without the literal backup URL")
            if re.search(r"\bgit\b[^\n]*\bpush\b", line):
                pushes += 1
            if re.search(r"\bgit\b[^\n]*\bpush\b[^\n]*--delete", line):
                if "--atomic" not in line:
                    violations.append(f"step {i}: delete without --atomic")
                if not re.search(r"--delete\s+\$expired\b", line):
                    violations.append(f"step {i}: delete not fed by $expired")
                if '[ -n "$expired" ]' not in run:
                    violations.append(f"step {i}: delete without an empty-list guard")
                listing = _PRUNE_LISTING.search(run)
                if listing is None or listing.group(1) != BACKUP_REPO:
                    violations.append(f"step {i}: $expired not fed by newest_backup.py expired")
    if pushes == 0:
        violations.append("no git push found")
    if not any("HEAD:refs/heads/" in _run(s) for s in steps):
        violations.append("no push of HEAD:refs/heads/<copy>")
    return violations


def check_ssh_options(steps: list[Step]) -> list[str]:
    """Each step that talks to the backup repository sets `GIT_SSH_COMMAND` with a pinned,
    absolute `UserKnownHostsFile`, `StrictHostKeyChecking=yes` and `IdentitiesOnly=yes`."""
    violations = []
    for i, step in enumerate(steps):
        if BACKUP_REPO not in _run(step):
            continue
        command = str(_env(step).get("GIT_SSH_COMMAND", ""))
        known = re.search(r"UserKnownHostsFile=(\$\{\{ github\.workspace \}\}\S*|\S+)", command)
        if known is None:
            violations.append(f"step {i}: no UserKnownHostsFile")
        elif not known.group(1).startswith(("/", "${{ github.workspace }}")):
            violations.append(f"step {i}: UserKnownHostsFile is not an absolute path")
        if "StrictHostKeyChecking=yes" not in command:
            violations.append(f"step {i}: StrictHostKeyChecking=yes is missing")
        if "IdentitiesOnly=yes" not in command:
            violations.append(f"step {i}: IdentitiesOnly=yes is missing")
    return violations


# -- Step order --------------------------------------------------------------------------

# label -> substrings that must all be in a step's `run:`; each must match exactly one step.
_ANCHORS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("encrypt", ("age -R",)),
    ("plaintext removal", ("rm backup.db",)),
    ("size check", ("stat -c %s",)),
    ("key write", ("install -m 600",)),
    ("push", ("HEAD:refs/heads/",)),
    ("prune", ("--delete",)),
    ("key removal", ("rm -f", "backup_key")),
)


def _find_unique(steps: list[Step], label: str, needles: tuple[str, ...]) -> tuple[int | None, str]:
    matches = [i for i, s in enumerate(steps) if all(n in _run(s) for n in needles)]
    if len(matches) != 1:
        return None, f"expected exactly one {label} step, found {len(matches)}"
    return matches[0], ""


def check_step_order(steps: list[Step]) -> list[str]:
    """encrypt < plaintext removal < size check < key write < push < prune < key removal,
    and the key removal is the last step, with `if: always()`."""
    violations = []
    indexes = []
    for label, needles in _ANCHORS:
        index, problem = _find_unique(steps, label, needles)
        if problem:
            violations.append(problem)
        indexes.append((label, index))
    found = [(label, index) for label, index in indexes if index is not None]
    for (before, i), (after, j) in zip(found, found[1:], strict=False):
        if i >= j:
            violations.append(f"{before} must come before {after}")
    removal = dict(indexes)["key removal"]
    if removal is not None:
        if removal != len(steps) - 1:
            violations.append("key removal must be the last step")
        if steps[removal].get("if") != "always()":
            violations.append("key removal must run with if: always()")
    return violations


def check_size_limit(steps: list[Step]) -> list[str]:
    index, problem = _find_unique(steps, "size check", ("stat -c %s",))
    if index is None:
        return [problem]
    expected = f'test "$(stat -c %s "$BACKUP_FILE")" -le {SIZE_LIMIT_BYTES}'
    return [] if _run(steps[index]).strip() == expected else [f"size check must run {expected!r}"]


def check_key_write(steps: list[Step]) -> list[str]:
    """The key file is created mode 600 before the key is written into it."""
    index, problem = _find_unique(steps, "key write", ("install -m 600",))
    if index is None:
        return [problem]
    expected = [
        'install -m 600 /dev/null "$RUNNER_TEMP/backup_key"',
        'printenv BACKUP_DEPLOY_KEY >> "$RUNNER_TEMP/backup_key"',
    ]
    found = [line.strip() for line in _run(steps[index]).strip().splitlines()]
    return [] if found == expected else [f"key write must run {expected!r}, got {found!r}"]


def find_workflow_violations(workflow: Workflow) -> list[str]:
    """Every checker, run over one parsed workflow."""
    steps = _steps(workflow)
    names = backup_copy_env_names(BACKUP_COPY_SCRIPT.read_text())
    violations: list[str] = []
    violations += check_triggers(workflow)
    violations += check_permissions(workflow)
    violations += check_job_if(workflow)
    violations += check_environment(workflow)
    violations += check_concurrency(workflow)
    violations += check_persist_credentials(steps)
    violations += check_no_stored_artifacts(steps)
    violations += check_secret_scope(workflow)
    violations += check_copy_env_names(steps, names)
    violations += check_forbidden_shell(steps)
    violations += check_no_force(steps)
    violations += check_pipefail(steps)
    violations += check_pushes(steps)
    violations += check_ssh_options(steps)
    violations += check_step_order(steps)
    violations += check_size_limit(steps)
    violations += check_key_write(steps)
    return violations


# -- A minimal, good fixture every bad fixture below is a one-field mutation of ----------

_SSH = (
    "ssh -i ${{ runner.temp }}/backup_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes "
    "-o UserKnownHostsFile=${{ github.workspace }}/deploy/github_known_hosts"
)
_COPY_NAMES = ["APOSTROPHE_DATABASE_AUTH_TOKEN", "APOSTROPHE_DATABASE_URL"]
_GOOD: Workflow = {
    True: {"schedule": [{"cron": "0 7 * * *"}], "workflow_dispatch": {}},
    "permissions": {"contents": "read"},
    "concurrency": {"group": "backup", "cancel-in-progress": False},
    "jobs": {
        "backup": {
            "if": "github.repository == 'GonzaloZevallos/apostrophe'",
            "environment": "backup",
            "steps": [
                {"uses": "actions/checkout@v7", "with": {"persist-credentials": False}},
                {"uses": "astral-sh/setup-uv@v10", "with": {"version": "0.12.13"}},
                {"run": "uv sync --locked"},
                {
                    "run": "uv run --no-project python scripts/backup_copy.py backup.db",
                    "env": {
                        "APOSTROPHE_DATABASE_URL": "${{ secrets.TURSO_DATABASE_URL }}",
                        "APOSTROPHE_DATABASE_AUTH_TOKEN": "${{ secrets.TURSO_READONLY_TOKEN }}",
                    },
                },
                {"run": 'age -R deploy/age-recipient.txt -o "$BACKUP_FILE" backup.db'},
                {"run": "rm backup.db"},
                {"run": 'test "$(stat -c %s "$BACKUP_FILE")" -le 94371840'},
                {
                    "run": (
                        'install -m 600 /dev/null "$RUNNER_TEMP/backup_key"\n'
                        'printenv BACKUP_DEPLOY_KEY >> "$RUNNER_TEMP/backup_key"\n'
                    ),
                    "env": {"BACKUP_DEPLOY_KEY": "${{ secrets.BACKUP_DEPLOY_KEY }}"},
                },
                {
                    "shell": "bash",
                    "env": {"GIT_SSH_COMMAND": _SSH},
                    "run": (
                        'git init -b main "$RUNNER_TEMP/copy"\n'
                        'mv "$BACKUP_FILE" "$RUNNER_TEMP/copy/"\n'
                        'git -C "$RUNNER_TEMP/copy" add -- "$BACKUP_FILE"\n'
                        'git -C "$RUNNER_TEMP/copy" -c user.name=bot commit -q -m "$BACKUP_FILE"\n'
                        f'git -C "$RUNNER_TEMP/copy" push {BACKUP_REPO} '
                        '"HEAD:refs/heads/$BACKUP_FILE"\n'
                    ),
                },
                {
                    "shell": "bash",
                    "env": {"GIT_SSH_COMMAND": _SSH},
                    "run": (
                        f'expired="$(git ls-remote --heads {BACKUP_REPO} | uv run --no-project '
                        "python scripts/newest_backup.py expired --now "
                        '"$(date -u +%Y%m%dT%H%M%SZ)")"\n'
                        'if [ -n "$expired" ]; then git push --atomic '
                        f"{BACKUP_REPO} --delete $expired; fi\n"
                    ),
                },
                {"if": "always()", "run": 'rm -f "$RUNNER_TEMP/backup_key"'},
            ],
        }
    },
}
_PUSH_STEP = 8
_PRUNE_STEP = 9


def _good() -> Workflow:
    return copy.deepcopy(_GOOD)


def _good_steps() -> list[Step]:
    return _steps(_good())


def _with_run(index: int, run: str) -> list[Step]:
    steps = _good_steps()
    steps[index]["run"] = run
    return steps


def test_every_checker_passes_the_good_fixture() -> None:
    good = _good()

    assert find_workflow_violations(good) == []
    assert check_copy_env_names(_steps(good), _COPY_NAMES) == []
    assert backup_copy_env_names(BACKUP_COPY_SCRIPT.read_text()) == _COPY_NAMES


# -- triggers ----------------------------------------------------------------------------


@pytest.mark.parametrize("trigger", ["push", "pull_request", "pull_request_target", "workflow_run"])
def test_the_triggers_checker_flags_a_forbidden_trigger(trigger: str) -> None:
    bad = _good()
    bad[True][trigger] = {}

    assert check_triggers(bad) != []


def test_the_triggers_checker_flags_a_missing_dispatch_and_a_changed_cron() -> None:
    no_dispatch = _good()
    del no_dispatch[True]["workflow_dispatch"]
    other_cron = _good()
    other_cron[True]["schedule"] = [{"cron": "0 8 * * *"}]

    assert check_triggers(no_dispatch) != []
    assert check_triggers(other_cron) != []


def test_the_triggers_checker_reads_the_string_on_key_too() -> None:
    string_key = _good()
    string_key["on"] = string_key.pop(True)
    string_key["on"]["push"] = {}

    assert check_triggers(string_key) != []
    assert check_triggers(_good()) == []


# -- permissions, job guard, environment, concurrency ------------------------------------


def test_the_permissions_checker_flags_missing_write_and_job_level_permissions() -> None:
    missing = _good()
    del missing["permissions"]
    write = _good()
    write["permissions"] = {"contents": "write"}
    wider = _good()
    wider["permissions"] = {"contents": "read", "actions": "write"}
    job_level = _good()
    job_level["jobs"]["backup"]["permissions"] = {"contents": "read"}

    for bad in (missing, write, wider, job_level):
        assert check_permissions(bad) != []
    assert check_permissions(_good()) == []


def test_the_job_if_checker_flags_a_missing_or_looser_guard() -> None:
    missing = _good()
    del missing["jobs"]["backup"]["if"]
    looser = _good()
    looser["jobs"]["backup"]["if"] = "github.repository_owner == 'GonzaloZevallos'"

    assert check_job_if(missing) != []
    assert check_job_if(looser) != []
    assert check_job_if(_good()) == []


def test_the_environment_checker_flags_a_missing_or_other_environment() -> None:
    missing = _good()
    del missing["jobs"]["backup"]["environment"]
    other = _good()
    other["jobs"]["backup"]["environment"] = "production"

    assert check_environment(missing) != []
    assert check_environment(other) != []
    assert check_environment(_good()) == []


def test_the_concurrency_checker_flags_cancelling_or_missing_concurrency() -> None:
    cancelling = _good()
    cancelling["concurrency"]["cancel-in-progress"] = True
    missing = _good()
    del missing["concurrency"]

    assert check_concurrency(cancelling) != []
    assert check_concurrency(missing) != []
    assert check_concurrency(_good()) == []


# -- checkout, stored artifacts ----------------------------------------------------------


def test_the_checkout_checker_flags_persisted_credentials() -> None:
    omitted = _good_steps()
    del omitted[0]["with"]
    true = _good_steps()
    true[0]["with"]["persist-credentials"] = True
    doubled = _good_steps() + [_good_steps()[0]]

    for bad in (omitted, true, doubled):
        assert check_persist_credentials(bad) != []
    assert check_persist_credentials(_good_steps()) == []


@pytest.mark.parametrize(
    "step",
    [
        {"uses": "actions/upload-artifact@v7"},
        {"uses": "actions/cache@v4"},
        {"uses": "softprops/action-gh-release@v2"},
        {"run": "gh run download 1"},
    ],
)
def test_the_stored_artifacts_checker_flags_each_forbidden_step(step: Step) -> None:
    assert check_no_stored_artifacts(_good_steps() + [step]) != []


def test_the_stored_artifacts_checker_passes_the_good_fixture() -> None:
    assert check_no_stored_artifacts(_good_steps()) == []


# -- secrets -----------------------------------------------------------------------------


def test_the_secret_scope_checker_flags_workflow_and_job_env() -> None:
    workflow_env = _good()
    workflow_env["env"] = {"X": "1"}
    job_env = _good()
    job_env["jobs"]["backup"]["env"] = {"X": "1"}

    assert check_secret_scope(workflow_env) != []
    assert check_secret_scope(job_env) != []


def test_the_secret_scope_checker_flags_a_secret_in_a_uses_step() -> None:
    bad = _good()
    _steps(bad)[0]["with"]["token"] = "${{ secrets.BACKUP_DEPLOY_KEY }}"

    assert check_secret_scope(bad) != []


def test_the_secret_scope_checker_flags_a_secret_inline_in_a_run() -> None:
    bad = _good()
    _steps(bad)[2]["run"] = 'uv sync --token "${{ secrets.TURSO_READONLY_TOKEN }}"'

    assert check_secret_scope(bad) != []


def test_the_secret_scope_checker_flags_a_secret_in_two_steps_and_in_none() -> None:
    twice = _good()
    _steps(twice)[_PUSH_STEP]["env"]["LEAK"] = "${{ secrets.BACKUP_DEPLOY_KEY }}"
    none = _good()
    del _steps(none)[7]["env"]

    assert check_secret_scope(twice) != []
    assert check_secret_scope(none) != []


def test_the_secret_scope_checker_flags_another_key_in_the_deploy_key_step() -> None:
    bad = _good()
    _steps(bad)[7]["env"]["EXTRA"] = "1"

    assert check_secret_scope(bad) != []


def test_the_secret_scope_checker_flags_a_secret_it_does_not_know() -> None:
    bad = _good()
    _steps(bad)[3]["env"]["TOKEN"] = "${{ secrets.GITHUB_TOKEN }}"

    assert check_secret_scope(bad) != []


def test_the_secret_scope_checker_reads_expressions_not_env_keys() -> None:
    keyed = _good()
    copy_env = _steps(keyed)[3]["env"]
    copy_env["TURSO_DATABASE_URL"] = copy_env.pop("APOSTROPHE_DATABASE_URL")

    assert check_secret_scope(keyed) == []
    assert check_secret_scope(_good()) == []


def test_the_copy_env_checker_flags_the_secret_names_used_as_keys() -> None:
    keyed = _good_steps()
    copy_env = keyed[3]["env"]
    copy_env["TURSO_DATABASE_URL"] = "${{ secrets.TURSO_DATABASE_URL }}"
    del copy_env["APOSTROPHE_DATABASE_URL"]

    assert check_copy_env_names(keyed, _COPY_NAMES) == [
        "the copy step lacks env key APOSTROPHE_DATABASE_URL"
    ]
    assert check_copy_env_names(_good_steps(), _COPY_NAMES) == []
    assert check_copy_env_names(_good_steps(), []) != []
    assert check_copy_env_names(_good_steps()[:3], _COPY_NAMES) != []


def test_the_script_names_are_read_from_its_source_by_both_spellings() -> None:
    source = 'x = _env("A_ONE")\ny = os.environ.get("B_TWO", "")\nz = os.environ.get(name, "")\n'

    assert backup_copy_env_names(source) == ["A_ONE", "B_TWO"]


# -- shell hygiene -----------------------------------------------------------------------

_BAD_SHELL = [
    ("echo", 'echo "BACKUP_FILE=x" >> "$GITHUB_ENV"'),
    ("cat", 'age -r "$(cat deploy/age-recipient.txt)" backup.db'),
    ("printf", 'printf "%s" "$BACKUP_FILE"'),
    ("tee", "ls | tee out.log"),
    ("curl", "curl https://example.invalid"),
    ("print(", "python -c \"print('x')\""),
    ("set -x", "set -x\nls"),
    ("GIT_TRACE", "GIT_TRACE=1 git ls-remote origin"),
    ("ssh -v", "ssh -v git@github.com"),
    ("ssh -v", "ssh -i key -vvv git@github.com"),
    ("--verbose", "git push --verbose origin main"),
    ("credential in a URL", "git push https://user:tok@github.com/x/y.git main"),
    ("bare printenv", "printenv | sort"),
    ("bare printenv", "printenv"),
]


@pytest.mark.parametrize(("label", "run"), _BAD_SHELL)
def test_the_forbidden_shell_checker_flags_each_word_alone(label: str, run: str) -> None:
    violations = check_forbidden_shell([{"run": run}])

    assert violations == [f"step 0: forbidden {label}"]


def test_the_forbidden_shell_checker_flags_tracing_in_a_step_env() -> None:
    traced = [{"run": "ls", "env": {"GIT_TRACE": "1"}}]
    verbose_ssh = [{"run": "ls", "env": {"GIT_SSH_COMMAND": "ssh -v -i key"}}]

    assert check_forbidden_shell(traced) == ["step 0: forbidden GIT_TRACE"]
    assert check_forbidden_shell(verbose_ssh) == ["step 0: forbidden ssh -v"]


def test_the_forbidden_shell_checker_lets_word_shaped_substrings_and_one_printenv_through() -> None:
    fine = [
        {"run": "ls category committee"},
        {"run": 'printenv BACKUP_DEPLOY_KEY >> "$RUNNER_TEMP/backup_key"'},
    ]

    assert check_forbidden_shell(fine) == []
    assert check_forbidden_shell(_good_steps()) == []


# -- no force ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "line",
    [
        f"git push --force {BACKUP_REPO} HEAD:refs/heads/x",
        f"git push --force-with-lease {BACKUP_REPO} HEAD:refs/heads/x",
        f"git push -f {BACKUP_REPO} HEAD:refs/heads/x",
        f"git push --mirror {BACKUP_REPO}",
        f"git push {BACKUP_REPO} +HEAD:refs/heads/x",
        f'git push {BACKUP_REPO} "+HEAD:refs/heads/x"',
        f"git push {BACKUP_REPO} \\\n  +HEAD:refs/heads/x",
    ],
)
def test_the_no_force_checker_flags_each_forced_push(line: str) -> None:
    assert check_no_force([{"run": line}]) != []


def test_the_no_force_checker_lets_a_plain_push_and_an_rm_f_through() -> None:
    steps = _good_steps()

    assert check_no_force(steps) == []
    assert check_no_force([{"run": 'git -c user.email=41898282+bot@x.y commit -m "$F"'}]) == []


# -- pipefail ----------------------------------------------------------------------------


def test_the_pipefail_checker_flags_a_pipe_without_bash_or_pipefail() -> None:
    assert check_pipefail([{"run": "a | b"}]) != []
    assert check_pipefail([{"run": "a | b", "shell": "sh"}]) != []


def test_the_pipefail_checker_passes_bash_pipefail_and_pipeless_runs() -> None:
    assert check_pipefail([{"run": "a | b", "shell": "bash"}]) == []
    assert check_pipefail([{"run": "set -o pipefail\na | b"}]) == []
    assert check_pipefail([{"run": "a && b"}]) == []
    assert check_pipefail(_good_steps()) == []


# -- pushes and deletes ------------------------------------------------------------------


def _replace_in(index: int, old: str, new: str) -> list[Step]:
    steps = _good_steps()
    assert old in steps[index]["run"]
    steps[index]["run"] = steps[index]["run"].replace(old, new)
    return steps


def test_the_pushes_checker_flags_a_push_to_a_variable_or_another_url() -> None:
    variable = _replace_in(_PUSH_STEP, BACKUP_REPO, '"$BACKUP_URL"')
    https = _replace_in(_PUSH_STEP, BACKUP_REPO, "https://github.com/GonzaloZevallos/x.git")
    delete_elsewhere = _replace_in(
        _PRUNE_STEP, f"push --atomic {BACKUP_REPO}", "push --atomic origin"
    )

    for bad in (variable, https, delete_elsewhere):
        assert check_pushes(bad) != []
    assert check_pushes(_good_steps()) == []


def test_the_pushes_checker_flags_an_ls_remote_or_clone_of_another_repository() -> None:
    listing = _replace_in(
        _PRUNE_STEP, f"ls-remote --heads {BACKUP_REPO}", "ls-remote --heads origin"
    )
    clone = _good_steps() + [{"run": "git clone --depth 1 origin copy"}]

    assert check_pushes(listing) != []
    assert check_pushes(clone) != []


def test_the_pushes_checker_flags_a_delete_that_is_not_atomic() -> None:
    bad = _replace_in(_PRUNE_STEP, "push --atomic", "push")

    assert check_pushes(bad) == ["step 9: delete without --atomic"]


def test_the_pushes_checker_flags_a_delete_not_fed_by_expired() -> None:
    literal = _replace_in(_PRUNE_STEP, "--delete $expired", "--delete backup-old")
    unguarded = _replace_in(_PRUNE_STEP, 'if [ -n "$expired" ]; then ', "if true; then ")
    other_filter = _replace_in(_PRUNE_STEP, "newest_backup.py expired", "newest_backup.py")

    for bad in (literal, unguarded, other_filter):
        assert check_pushes(bad) != []


def test_the_pushes_checker_flags_a_workflow_with_no_push_to_a_copy_branch() -> None:
    bad = _replace_in(_PUSH_STEP, "HEAD:refs/heads/$BACKUP_FILE", "HEAD:main")

    assert check_pushes(bad) != []


# -- ssh options -------------------------------------------------------------------------


def _with_ssh(command: str) -> list[Step]:
    steps = _good_steps()
    steps[_PUSH_STEP]["env"]["GIT_SSH_COMMAND"] = command
    return steps


@pytest.mark.parametrize(
    "mutation",
    [
        lambda c: c.replace(
            "-o UserKnownHostsFile=${{ github.workspace }}/deploy/github_known_hosts", ""
        ),
        lambda c: c.replace(
            "${{ github.workspace }}/deploy/github_known_hosts", "deploy/github_known_hosts"
        ),
        lambda c: c.replace("${{ github.workspace }}/deploy/github_known_hosts", "~/known_hosts"),
        lambda c: c.replace("StrictHostKeyChecking=yes", "StrictHostKeyChecking=no"),
        lambda c: c.replace("-o IdentitiesOnly=yes", ""),
    ],
)
def test_the_ssh_options_checker_flags_each_missing_or_relaxed_option(
    mutation: Callable[[str], str],
) -> None:
    assert check_ssh_options(_with_ssh(mutation(_SSH))) != []


def test_the_ssh_options_checker_flags_a_step_without_the_command_and_passes_good() -> None:
    steps = _good_steps()
    del steps[_PRUNE_STEP]["env"]

    assert check_ssh_options(steps) != []
    assert check_ssh_options(_with_ssh(_SSH.replace("${{ github.workspace }}", "/work"))) == []
    assert check_ssh_options(_good_steps()) == []


# -- step order --------------------------------------------------------------------------


def test_the_step_order_checker_flags_each_step_out_of_place() -> None:
    steps = _good_steps()
    for first in range(4, 9):
        swapped = copy.deepcopy(steps)
        swapped[first], swapped[first + 1] = swapped[first + 1], swapped[first]
        assert check_step_order(swapped) != [], first
    assert check_step_order(steps) == []


def test_the_step_order_checker_flags_a_key_removal_that_is_not_last_or_not_always() -> None:
    not_last = _good_steps() + [{"run": "uv --version"}]
    no_always = _good_steps()
    del no_always[-1]["if"]
    on_success = _good_steps()
    on_success[-1]["if"] = "success()"

    for bad in (not_last, no_always, on_success):
        assert check_step_order(bad) != []


@pytest.mark.parametrize("index", range(4, 11))
def test_each_step_finder_flags_a_missing_and_a_doubled_step(index: int) -> None:
    # The anchors are unique per step: a finder that finds zero or two steps is itself
    # a violation, so a doubled `rm backup.db` or a second `git push` cannot slip by.
    missing = _good_steps()
    del missing[index]
    doubled = _good_steps()
    doubled.insert(index, copy.deepcopy(doubled[index]))

    assert any("expected exactly one" in v for v in check_step_order(missing))
    assert any("expected exactly one" in v for v in check_step_order(doubled))


def test_the_size_checker_flags_a_wrong_limit_and_a_missing_step() -> None:
    wrong = _with_run(6, 'test "$(stat -c %s "$BACKUP_FILE")" -le 104857600')
    printing = _with_run(6, 'stat -c %s "$BACKUP_FILE"')
    missing = _good_steps()
    del missing[6]

    for bad in (wrong, printing, missing):
        assert check_size_limit(bad) != []
    assert check_size_limit(_good_steps()) == []


def test_the_key_write_checker_flags_a_key_written_before_it_is_protected() -> None:
    wrong_order = _with_run(
        7,
        'printenv BACKUP_DEPLOY_KEY >> "$RUNNER_TEMP/backup_key"\n'
        'install -m 600 /dev/null "$RUNNER_TEMP/backup_key"\n',
    )
    loose = _with_run(
        7,
        'install -m 644 /dev/null "$RUNNER_TEMP/backup_key"\n'
        'printenv BACKUP_DEPLOY_KEY >> "$RUNNER_TEMP/backup_key"\n',
    )

    assert check_key_write(wrong_order) != []
    assert check_key_write(loose) != []
    assert check_key_write(_good_steps()) == []


# -- the real workflow -------------------------------------------------------------------


def test_the_checker_set_flags_a_good_fixture_with_one_mutation() -> None:
    bad = _good()
    bad[True]["push"] = {}

    assert find_workflow_violations(bad) != []


def test_backup_workflow_satisfies_every_invariant() -> None:
    workflow = yaml.safe_load(BACKUP_WORKFLOW.read_text())

    assert find_workflow_violations(workflow) == []


def test_the_real_workflow_names_the_actions_and_the_trigger_key_the_checkers_read() -> None:
    workflow = yaml.safe_load(BACKUP_WORKFLOW.read_text())

    assert True in workflow  # PyYAML parses the bare key `on` as the boolean True
    assert len(_steps(workflow)) >= 11


# -- deploy/github_known_hosts -----------------------------------------------------------


def check_known_hosts(text: str) -> list[str]:
    """One line: `github.com ssh-ed25519 <key>`, no RSA or ECDSA key, a key that decodes
    as an ed25519 public-key blob and whose SHA256 fingerprint is the one GitHub publishes."""
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) != 1 or not text.endswith("\n"):
        return [f"expected exactly one newline-terminated line, found {len(lines)}"]
    violations = [f"{bad} is forbidden" for bad in ("ssh-rsa", "ecdsa-") if bad in text]
    fields = lines[0].split(" ")
    if len(fields) != 3:
        return violations + ["the line is not '<host> <type> <key>'"]
    host, key_type, encoded = fields
    if host != "github.com":
        violations.append(f"host must be github.com, got {host!r}")
    if key_type != "ssh-ed25519":
        violations.append(f"type must be ssh-ed25519, got {key_type!r}")
    try:
        blob = base64.b64decode(encoded, validate=True)
    except binascii.Error:
        return violations + ["the key does not base64-decode"]
    if not blob.startswith(b"\x00\x00\x00\x0bssh-ed25519"):
        violations.append("the decoded key is not an ssh-ed25519 blob")
    fingerprint = base64.b64encode(hashlib.sha256(blob).digest()).rstrip(b"=").decode()
    if fingerprint != GITHUB_ED25519_FINGERPRINT:
        violations.append(f"fingerprint {fingerprint} is not GitHub's published one")
    return violations


_PINNED_LINE = (
    "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n"
)


def test_the_known_hosts_checker_flags_a_changed_key_that_still_decodes() -> None:
    changed = _PINNED_LINE.replace("9GKJl", "9GKJm")

    assert base64.b64decode(changed.split()[2], validate=True)
    violations = check_known_hosts(changed)
    assert len(violations) == 1
    assert "fingerprint" in violations[0]


@pytest.mark.parametrize(
    "text",
    [
        _PINNED_LINE + _PINNED_LINE,
        "",
        _PINNED_LINE.rstrip("\n"),
        _PINNED_LINE.replace("github.com", "gitlab.com"),
        _PINNED_LINE.replace("ssh-ed25519", "ssh-rsa"),
        _PINNED_LINE + "github.com ecdsa-sha2-nistp256 AAAA\n",
        "github.com ssh-ed25519 not*base64\n",
        "github.com ssh-ed25519\n",
    ],
)
def test_the_known_hosts_checker_flags_each_malformed_file(text: str) -> None:
    assert check_known_hosts(text) != []


def test_deploy_github_known_hosts_is_githubs_pinned_ed25519_key() -> None:
    assert check_known_hosts(KNOWN_HOSTS.read_text()) == []


# -- the one literal backup URL, in the workflow and the docs -----------------------------


def find_backup_url_mentions(text: str) -> list[str]:
    """Every URL-like mention of `apostrophe-backups` (`git@…` or `https://…`) that is
    not exactly `BACKUP_REPO`. A plain prose mention of the name is allowed."""
    mentions = re.findall(r"(?:git@|https?://)\S*apostrophe-backups\S*", text)
    return [m for m in (m.rstrip(".,;:)`\"'>") for m in mentions) if m != BACKUP_REPO]


def find_deploy_key_use(text: str) -> list[str]:
    """What a restore or drill instruction must never carry: the deploy key's secret
    expression, its key file or the SSH command that uses it."""
    return [
        needle
        for needle in ("secrets.BACKUP_DEPLOY_KEY", "GIT_SSH_COMMAND", "backup_key")
        if needle in text
    ]


@pytest.mark.parametrize(
    "text",
    [
        "git clone https://github.com/GonzaloZevallos/apostrophe-backups.git",
        "git clone https://x-access-token:abc@github.com/GonzaloZevallos/apostrophe-backups.git",
        "git clone git@github.com:Other/apostrophe-backups.git",
        "git push git@github.com:GonzaloZevallos/apostrophe-backups",
        "git push git@github.com:GonzaloZevallos/apostrophe-backups.git/",
    ],
)
def test_the_url_checker_flags_each_other_spelling(text: str) -> None:
    assert find_backup_url_mentions(text) != []


def test_the_url_checker_lets_the_literal_and_prose_through() -> None:
    assert find_backup_url_mentions(f"git clone {BACKUP_REPO} copy") == []
    assert find_backup_url_mentions(f"(`{BACKUP_REPO}`).") == []
    assert find_backup_url_mentions("the private apostrophe-backups repository") == []


def test_the_deploy_key_checker_flags_each_use() -> None:
    assert find_deploy_key_use("key: ${{ secrets.BACKUP_DEPLOY_KEY }}") != []
    assert find_deploy_key_use("GIT_SSH_COMMAND='ssh -i k' git clone") != []
    assert find_deploy_key_use("ssh -i $RUNNER_TEMP/backup_key") != []
    assert find_deploy_key_use("the `BACKUP_DEPLOY_KEY` environment secret") == []


def test_the_workflow_and_both_documents_spell_the_backup_url_one_way() -> None:
    for path in (BACKUP_WORKFLOW, README, ADR):
        text = path.read_text()
        assert find_backup_url_mentions(text) == [], path.name
        assert BACKUP_REPO in text, path.name


def test_no_document_tells_the_restore_to_use_the_deploy_key() -> None:
    for path in (README, ADR):
        assert find_deploy_key_use(path.read_text()) == [], path.name


def test_the_readme_chooses_the_newest_copy_with_the_script_and_not_gh_run_list() -> None:
    text = README.read_text()

    assert "newest_backup.py" in text
    assert "gh run list" not in text
