"""`.github/workflows/backup.yml`'s own invariants (the plan): a workflow-level
`permissions: {contents: read}`, exactly one `actions/upload-artifact@` step that
uploads nothing but `${{ env.BACKUP_FILE }}` for 30 days, the plaintext copy removed
between encryption and upload, and no `run:` step that echoes, prints or otherwise
leaks a secret or the dump's own content.

Parsed with PyYAML into a plain `dict`, never read as text lines (`tests/test_no_secrets.py`
reads text; this reads structure). The workflow's own `on:` key is never indexed here:
PyYAML parses YAML 1.1, where the bare key `on` loads as the boolean `True`, not the
string `"on"` — a trap this file sidesteps by never touching that key at all. Only
`permissions` and `jobs.backup.steps` are read, and steps are ever found by their
`uses` prefix or their position among the list, never by a step's `name:` (a comment,
not a seam).

Every checker below is proven against a deliberately bad fixture — a minimal
`dict`, built in Python, not a second YAML file — before it is trusted to pass over
the real workflow (`tests/test_no_secrets.py`'s own proven-negative-first shape).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKUP_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "backup.yml"

_FORBIDDEN_SHELL_WORDS = ("echo", "cat", "printf", "tee")


def check_permissions(permissions: object) -> list[str]:
    """The only violation: the workflow-level `permissions` block is anything other
    than exactly `{"contents": "read"}` (no `write`, no other scope, not missing)."""
    if permissions != {"contents": "read"}:
        return [f"permissions must be exactly {{'contents': 'read'}}, got {permissions!r}"]
    return []


def check_upload_step(steps: list[dict[str, Any]]) -> list[str]:
    """Exactly one `actions/upload-artifact@` step, named and uploading nothing but
    `${{ env.BACKUP_FILE }}` (no wildcard, no directory, not `backup.db`), kept for
    exactly 30 days, stored without recompression, and erroring instead of silently
    skipping when the file is missing."""
    violations: list[str] = []
    uploads = [
        step for step in steps if str(step.get("uses", "")).startswith("actions/upload-artifact@")
    ]
    if len(uploads) != 1:
        violations.append(f"expected exactly one upload-artifact step, found {len(uploads)}")
        return violations
    upload = uploads[0]
    with_block = upload.get("with", {})
    if not isinstance(with_block, dict):
        with_block = {}
    name = with_block.get("name")
    if name != "${{ env.BACKUP_FILE }}":
        violations.append(f"upload name must be exactly '${{ env.BACKUP_FILE }}', got {name!r}")
    path = with_block.get("path")
    if path != "${{ env.BACKUP_FILE }}":
        violations.append(f"upload path must be exactly '${{ env.BACKUP_FILE }}', got {path!r}")
    if with_block.get("retention-days") != 30:
        violations.append(f"retention-days must be 30, got {with_block.get('retention-days')!r}")
    if with_block.get("compression-level") != 0:
        violations.append(
            f"compression-level must be 0, got {with_block.get('compression-level')!r}"
        )
    if with_block.get("if-no-files-found") != "error":
        violations.append(
            f"if-no-files-found must be 'error', got {with_block.get('if-no-files-found')!r}"
        )
    return violations


def check_step_order(steps: list[dict[str, Any]]) -> list[str]:
    """The encrypt step (`age` with `-R deploy/age-recipient.txt`) comes before the
    step that removes the plaintext copy (`rm backup.db`, the whole command), which
    in turn comes before the upload-artifact step."""
    violations: list[str] = []

    def _is_encrypt_step(step: dict[str, Any]) -> bool:
        run = str(step.get("run", ""))
        return "age" in run and "-R deploy/age-recipient.txt" in run

    encrypt_index = next(
        (i for i, step in enumerate(steps) if _is_encrypt_step(step)),
        None,
    )
    rm_index = next(
        (i for i, step in enumerate(steps) if str(step.get("run", "")).strip() == "rm backup.db"),
        None,
    )
    upload_index = next(
        (
            i
            for i, step in enumerate(steps)
            if str(step.get("uses", "")).startswith("actions/upload-artifact@")
        ),
        None,
    )

    if encrypt_index is None:
        violations.append("no step runs age with -R deploy/age-recipient.txt")
    if rm_index is None:
        violations.append("no step removes backup.db with the exact command 'rm backup.db'")
    if upload_index is None:
        violations.append("no upload-artifact step found")

    if encrypt_index is not None and rm_index is not None and not encrypt_index < rm_index:
        violations.append("rm backup.db must come after the encrypt step")
    if rm_index is not None and upload_index is not None and not rm_index < upload_index:
        violations.append("rm backup.db must come before the upload-artifact step")

    return violations


def check_forbidden_shell(steps: list[dict[str, Any]]) -> list[str]:
    """No `run:` step contains the shell words `echo`, `cat`, `printf` or `tee` (as
    whole words, so `category` or `committee` never false-positive), the text
    `print(`, or the text `secrets.` — a secret reaches a step only through its
    `env:`, never inlined into its shell command."""
    violations: list[str] = []
    for i, step in enumerate(steps):
        run = step.get("run")
        if not isinstance(run, str):
            continue
        for word in _FORBIDDEN_SHELL_WORDS:
            if re.search(rf"\b{word}\b", run):
                violations.append(f"step {i}: forbidden shell word '{word}'")
        if "print(" in run:
            violations.append(f"step {i}: forbidden text 'print('")
        if "secrets." in run:
            violations.append(f"step {i}: forbidden text 'secrets.'")
    return violations


def find_workflow_violations(workflow: dict[str, Any]) -> list[str]:
    """Every checker above, run over one parsed workflow."""
    permissions = workflow.get("permissions")
    steps = workflow.get("jobs", {}).get("backup", {}).get("steps", [])
    violations: list[str] = []
    violations += check_permissions(permissions)
    violations += check_upload_step(steps)
    violations += check_step_order(steps)
    violations += check_forbidden_shell(steps)
    return violations


# -- A minimal, good fixture every bad fixture below is a one-field mutation of. --

_GOOD_STEPS: list[dict[str, Any]] = [
    {"name": "Encrypt", "run": 'age -R deploy/age-recipient.txt -o "$BACKUP_FILE" backup.db'},
    {"name": "Remove the plaintext copy", "run": "rm backup.db"},
    {
        "name": "Upload",
        "uses": "actions/upload-artifact@v4",
        "with": {
            "name": "${{ env.BACKUP_FILE }}",
            "path": "${{ env.BACKUP_FILE }}",
            "if-no-files-found": "error",
            "retention-days": 30,
            "compression-level": 0,
        },
    },
]


def test_the_permissions_checker_flags_a_missing_block() -> None:
    assert check_permissions(None) != []


def test_the_permissions_checker_flags_write_access() -> None:
    assert check_permissions({"contents": "write"}) != []


def test_the_permissions_checker_passes_the_exact_block() -> None:
    assert check_permissions({"contents": "read"}) == []


def test_the_upload_checker_flags_a_wildcard_path() -> None:
    bad = [{**_GOOD_STEPS[2], "with": {**_GOOD_STEPS[2]["with"], "path": "backup-*.db.age"}}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_a_directory_path() -> None:
    bad = [{**_GOOD_STEPS[2], "with": {**_GOOD_STEPS[2]["with"], "path": "backups/"}}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_backup_db_as_the_path() -> None:
    bad = [{**_GOOD_STEPS[2], "with": {**_GOOD_STEPS[2]["with"], "path": "backup.db"}}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_two_upload_steps() -> None:
    bad = [_GOOD_STEPS[2], _GOOD_STEPS[2]]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_missing_retention() -> None:
    with_block = {k: v for k, v in _GOOD_STEPS[2]["with"].items() if k != "retention-days"}
    bad = [{**_GOOD_STEPS[2], "with": with_block}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_backup_db_as_the_name() -> None:
    bad = [{**_GOOD_STEPS[2], "with": {**_GOOD_STEPS[2]["with"], "name": "backup.db"}}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_a_missing_compression_level() -> None:
    with_block = {k: v for k, v in _GOOD_STEPS[2]["with"].items() if k != "compression-level"}
    bad = [{**_GOOD_STEPS[2], "with": with_block}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_a_nonzero_compression_level() -> None:
    bad = [{**_GOOD_STEPS[2], "with": {**_GOOD_STEPS[2]["with"], "compression-level": 6}}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_flags_a_wrong_if_no_files_found() -> None:
    bad = [{**_GOOD_STEPS[2], "with": {**_GOOD_STEPS[2]["with"], "if-no-files-found": "warn"}}]

    assert check_upload_step(bad) != []


def test_the_upload_checker_passes_the_good_fixture() -> None:
    assert check_upload_step([_GOOD_STEPS[2]]) == []


def test_the_step_order_checker_flags_rm_missing() -> None:
    bad = [_GOOD_STEPS[0], _GOOD_STEPS[2]]

    assert check_step_order(bad) != []


def test_the_step_order_checker_flags_rm_before_encrypt() -> None:
    bad = [_GOOD_STEPS[1], _GOOD_STEPS[0], _GOOD_STEPS[2]]

    assert check_step_order(bad) != []


def test_the_step_order_checker_flags_upload_before_rm() -> None:
    bad = [_GOOD_STEPS[0], _GOOD_STEPS[2], _GOOD_STEPS[1]]

    assert check_step_order(bad) != []


def test_the_step_order_checker_passes_the_good_fixture() -> None:
    assert check_step_order(_GOOD_STEPS) == []


def test_the_forbidden_shell_checker_flags_echo() -> None:
    # Isolated to `echo` alone: no `cat`, `printf`, `tee`, `print(` or `secrets.`
    # anywhere in the line, so only the `echo` branch can be making this pass.
    bad = [{"run": 'echo "BACKUP_FILE=x" >> "$GITHUB_ENV"'}]

    assert check_forbidden_shell(bad) == ["step 0: forbidden shell word 'echo'"]


def test_the_forbidden_shell_checker_flags_cat() -> None:
    # Isolated to `cat` alone: no `echo` in this line.
    bad = [{"run": 'age -r "$(cat deploy/age-recipient.txt)" -o out backup.db'}]

    assert check_forbidden_shell(bad) == ["step 0: forbidden shell word 'cat'"]


def test_the_forbidden_shell_checker_flags_printf() -> None:
    # Isolated to `printf` alone: no `echo`, `cat` or `tee`.
    bad = [{"run": 'printf "%s" "$BACKUP_FILE"'}]

    assert check_forbidden_shell(bad) == ["step 0: forbidden shell word 'printf'"]


def test_the_forbidden_shell_checker_flags_tee() -> None:
    # Isolated to `tee` alone: no `echo` this time, unlike a shape such as
    # `echo nothing | tee out.log`, which the `echo` branch alone would already
    # flag, leaving the `tee` branch untested against an input only it rejects.
    bad = [{"run": "ls | tee out.log"}]

    assert check_forbidden_shell(bad) == ["step 0: forbidden shell word 'tee'"]


def test_the_forbidden_shell_checker_flags_print_call() -> None:
    # Isolated to `print(` alone: `print` is not itself a forbidden shell word, and
    # `printf` never matches `print(`'s literal parenthesis.
    bad = [{"run": "python -c \"print('x')\""}]

    assert check_forbidden_shell(bad) == ["step 0: forbidden text 'print('"]


def test_the_forbidden_shell_checker_flags_an_inline_secret() -> None:
    # Isolated to `secrets.` alone: no `echo`, unlike `echo "${{ secrets.X }}"`,
    # which the `echo` branch alone would already flag, leaving the `secrets.`
    # branch untested against an input only it rejects.
    bad = [{"run": 'curl -H "x: ${{ secrets.TOKEN }}"'}]

    assert check_forbidden_shell(bad) == ["step 0: forbidden text 'secrets.'"]


def test_the_forbidden_shell_checker_lets_a_word_shaped_substring_through() -> None:
    # `category` and `committee` contain `cat` and `tee` as substrings, not as whole
    # shell words; the checker must not flag them.
    fine = [{"run": "ls category committee"}]

    assert check_forbidden_shell(fine) == []


def test_the_forbidden_shell_checker_passes_the_good_fixture() -> None:
    assert check_forbidden_shell(_GOOD_STEPS) == []


def test_find_workflow_violations_flags_a_wrong_permissions_block() -> None:
    bad = {"permissions": {"contents": "write"}, "jobs": {"backup": {"steps": _GOOD_STEPS}}}

    assert find_workflow_violations(bad) != []


def test_backup_workflow_satisfies_every_invariant() -> None:
    workflow = yaml.safe_load(BACKUP_WORKFLOW.read_text())

    assert find_workflow_violations(workflow) == []
