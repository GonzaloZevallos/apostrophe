"""The OpenAPI breaking-change check of the CI `docs` job (ADR-0065).

On a pull request, compares `docs/api/openapi.json` with the one at the base ref using the
pinned `oasdiff` binary. A break fails the job unless the pull request body has a line
`Breaking-API: <reason>`. `verdict` is pure; `read_base_spec` and `main` call git and oasdiff
as subprocesses. The pull request body is read, never logged.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from enum import Enum, StrEnum
from pathlib import Path

SPEC_PATH = "docs/api/openapi.json"
# oasdiff exit codes, measured on the pinned binary (v1.35.0) with `--fail-on ERR`: 0 means no
# break, 1 means a breaking change, and anything else (102 for a spec it cannot load) means
# it did not complete a comparison.
OASDIFF_NO_BREAK = 0
OASDIFF_BREAK = 1
DECLARATION = re.compile(r"^Breaking-API:[ \t]*(\S.*?)[ \t]*$", re.MULTILINE)


class Verdict(StrEnum):
    SKIP = "SKIP"
    PASS = "PASS"
    DECLARED_BREAK = "DECLARED_BREAK"
    FAIL = "FAIL"


class BaseSpecMissing(Enum):
    ABSENT = "absent"  # the base ref exists and has no spec: nothing to compare with
    REF_MISSING = "ref missing"  # the base ref itself is not there


def has_declaration(pr_body: str | None) -> bool:
    """True when a line of the body is `Breaking-API:` followed by a non-empty reason."""
    return DECLARATION.search((pr_body or "").replace("\r\n", "\n")) is not None


def verdict(base_spec: str | None, oasdiff_exit: int | None, pr_body: str | None) -> Verdict:
    """What the job does. A comparison oasdiff did not complete is never a declared break."""
    if base_spec is None:
        return Verdict.SKIP
    if oasdiff_exit == OASDIFF_NO_BREAK:
        return Verdict.PASS
    if oasdiff_exit == OASDIFF_BREAK and has_declaration(pr_body):
        return Verdict.DECLARED_BREAK
    return Verdict.FAIL


def _git_ok(cwd: Path, *args: str) -> bool:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, check=False).returncode == 0


def read_base_spec(base_ref: str, cwd: Path) -> str | BaseSpecMissing:
    """The spec text at `origin/<base_ref>`, or why there is none."""
    ref = f"origin/{base_ref}"
    if not _git_ok(cwd, "rev-parse", "--verify", "--quiet", ref):
        return BaseSpecMissing.REF_MISSING
    if not _git_ok(cwd, "cat-file", "-e", f"{ref}:{SPEC_PATH}"):
        return BaseSpecMissing.ABSENT
    shown = subprocess.run(
        ["git", "show", f"{ref}:{SPEC_PATH}"],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return shown.stdout


def _run_oasdiff(base_spec: str, cwd: Path, runner_temp: Path) -> int | None:
    """oasdiff's exit code, or None when the binary is not there. The base spec is written
    under `runner_temp`, never into the repository or the system temporary directory."""
    with tempfile.TemporaryDirectory(dir=runner_temp) as tmp:
        base_file = Path(tmp) / "base-openapi.json"
        base_file.write_text(base_spec, encoding="utf-8")
        try:
            done = subprocess.run(
                ["oasdiff", "breaking", str(base_file), SPEC_PATH, "--fail-on", "ERR"],
                cwd=cwd,
                check=False,
            )
        except FileNotFoundError:
            return None
        return done.returncode


def main() -> int:
    if os.environ.get("GITHUB_EVENT_NAME") != "pull_request":
        print("api_breaks: SKIP, not a pull_request event")
        return 0
    cwd = Path.cwd()
    base = read_base_spec(os.environ.get("GITHUB_BASE_REF", ""), cwd)
    if base is BaseSpecMissing.REF_MISSING:
        print("api_breaks: FAIL, the base ref origin/<GITHUB_BASE_REF> is not in the checkout")
        return 1
    if base is BaseSpecMissing.ABSENT:
        print(f"api_breaks: SKIP, the base ref has no {SPEC_PATH}")
        return 0
    runner_temp = os.environ.get("RUNNER_TEMP")
    if not runner_temp:
        print("api_breaks: FAIL, RUNNER_TEMP is not set, nowhere safe to write the base spec")
        return 1
    oasdiff_exit = _run_oasdiff(base, cwd, Path(runner_temp))
    result = verdict(base, oasdiff_exit, os.environ.get("PR_BODY"))
    print(f"api_breaks: {result.name} (oasdiff exit {oasdiff_exit})")
    return 1 if result is Verdict.FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
