"""The OpenAPI breaking-change check of the CI `docs` job (ADR-0066).

On a pull request, compares the spec the job's `scripts.docs.generate` just wrote into the workspace
(`docs/api/openapi.json`, the head) with a spec generated from the code at the tip of
`origin/$GITHUB_BASE_REF` (the base), using the pinned `oasdiff` binary. Neither side is ever read
from a committed copy. The base is built in a throwaway git worktree under `$RUNNER_TEMP`:
`uv sync --locked` into the worktree's own `.venv`, then `BASE_EXPORT` runs in that venv. A break
fails the job unless the pull request body has a line `Breaking-API: <reason>`. `verdict` is pure;
everything else calls git, uv, python and oasdiff through an injected `Run`. The pull request body
is read once, passed only to `verdict`, never logged and never put in a child's environment.

`build_docs_app` and `export_openapi` of `scripts.docs.openapi_export` are a contract: `BASE_EXPORT`
calls both by name at the base tip, so renaming either takes two steps (add the new name, then
remove the old one after the base has it).

A non-pull_request event and a base without `scripts/docs/openapi_export.py` are the only runs that
compare nothing and succeed. A missing base ref, a failed or timed-out sync or export, an empty
export and a missing workspace spec are FAIL, each naming its step; there is no retry.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from enum import Enum, StrEnum
from pathlib import Path

SPEC_PATH = "docs/api/openapi.json"
EXPORT_MODULE = "scripts/docs/openapi_export.py"
# oasdiff exit codes, measured on the pinned binary (v1.35.0) with `--fail-on ERR`: 0 means no
# break, 1 means a breaking change, and anything else (102 for a spec it cannot load) means
# it did not complete a comparison.
OASDIFF_NO_BREAK = 0
OASDIFF_BREAK = 1
DECLARATION = re.compile(r"^Breaking-API:[ \t]*(\S.*?)[ \t]*$", re.MULTILINE)

# The runner's code for a child that ran out of time; a child's own exit code is never negative.
TIMED_OUT = -1
SYNC_TIMEOUT = 300.0
EXPORT_TIMEOUT = 60.0
GIT_TIMEOUT = 60.0
OASDIFF_TIMEOUT = 120.0

# The program `python -c` runs inside the base worktree's venv; argv[1] is the output path.
BASE_EXPORT = (
    "import sys; "
    "from scripts.docs.openapi_export import build_docs_app, export_openapi; "
    "open(sys.argv[1], 'w', encoding='utf-8').write(export_openapi(build_docs_app()))"
)

Run = Callable[[Sequence[str], Path, Mapping[str, str], float], int]


class Verdict(StrEnum):
    SKIP = "SKIP"
    PASS = "PASS"
    DECLARED_BREAK = "DECLARED_BREAK"
    FAIL = "FAIL"


class BaseSpecMissing(Enum):
    NO_EXPORT_MODULE = "no export module"  # the base ref exists and cannot generate a spec
    REF_MISSING = "ref missing"  # the base ref itself is not there


class BaseExportFailed(Exception):
    """A step of building the base spec failed: `step` is 'worktree', 'sync' or 'export'."""

    def __init__(self, step: str, code: int) -> None:
        super().__init__(f"base {step} failed with code {code}")
        self.step = step
        self.code = code


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


def default_run(argv: Sequence[str], cwd: Path, env: Mapping[str, str], timeout: float) -> int:
    """Run a child to completion; `TIMED_OUT` when it outlives `timeout`."""
    try:
        return subprocess.run(argv, cwd=cwd, env=env, timeout=timeout, check=False).returncode
    except subprocess.TimeoutExpired:
        return TIMED_OUT


def base_env(parent: Mapping[str, str], worktree: Path) -> dict[str, str]:
    """The environment of every child: the parent's, without the pull request body or anything
    that would point uv or python at the head's venv, and with uv syncing into the worktree."""
    dropped = {"PR_BODY", "VIRTUAL_ENV", "PYTHONPATH", "UV_PROJECT_ENVIRONMENT"}
    env = {key: value for key, value in parent.items() if key not in dropped}
    env["UV_PROJECT_ENVIRONMENT"] = str(worktree / ".venv")
    return env


def base_export_argv(python: Path, out_path: Path) -> list[str]:
    """The argv that writes the app's OpenAPI document of the code at hand to `out_path`."""
    return [str(python), "-c", BASE_EXPORT, str(out_path)]


def generate_base_spec(
    base_ref: str, cwd: Path, runner_temp: Path, run: Run
) -> str | BaseSpecMissing:
    """The spec text generated from the code at the tip of `origin/<base_ref>`, or why there is
    none. Raises `BaseExportFailed` when the worktree, the sync or the export fails."""
    ref = f"origin/{base_ref}"
    tmp = Path(tempfile.mkdtemp(dir=runner_temp, prefix="api-breaks-base-"))
    worktree = tmp / "base"
    env = base_env(os.environ, worktree)
    try:
        if run(["git", "rev-parse", "--verify", "--quiet", ref], cwd, env, GIT_TIMEOUT) != 0:
            return BaseSpecMissing.REF_MISSING
        if run(["git", "cat-file", "-e", f"{ref}:{EXPORT_MODULE}"], cwd, env, GIT_TIMEOUT) != 0:
            return BaseSpecMissing.NO_EXPORT_MODULE
        run(["git", "worktree", "prune"], cwd, env, GIT_TIMEOUT)
        added = run(
            ["git", "worktree", "add", "--detach", str(worktree), ref], cwd, env, GIT_TIMEOUT
        )
        if added != 0:
            raise BaseExportFailed("worktree", added)
        synced = run(["uv", "sync", "--locked"], worktree, env, SYNC_TIMEOUT)
        if synced != 0:
            raise BaseExportFailed("sync", synced)
        out_path = tmp / "base-openapi.json"
        argv = base_export_argv(worktree / ".venv" / "bin" / "python", out_path)
        exported = run(argv, worktree, env, EXPORT_TIMEOUT)
        if exported != 0:
            raise BaseExportFailed("export", exported)
        text = out_path.read_text(encoding="utf-8") if out_path.is_file() else ""
        if not text.strip():
            raise BaseExportFailed("export", 0)
        return text
    finally:
        if worktree.exists():
            run(["git", "worktree", "remove", "--force", str(worktree)], cwd, env, GIT_TIMEOUT)
        run(["git", "worktree", "prune"], cwd, env, GIT_TIMEOUT)
        shutil.rmtree(tmp, ignore_errors=True)


def _run_oasdiff(base_spec: str, cwd: Path, runner_temp: Path, run: Run) -> int | None:
    """oasdiff's exit code, or None when the binary is not there. The base spec is written
    under `runner_temp`, never into the repository or the system temporary directory."""
    with tempfile.TemporaryDirectory(dir=runner_temp) as tmp:
        base_file = Path(tmp) / "base-openapi.json"
        base_file.write_text(base_spec, encoding="utf-8")
        argv = ["oasdiff", "breaking", str(base_file), SPEC_PATH, "--fail-on", "ERR"]
        try:
            return run(argv, cwd, base_env(os.environ, cwd), OASDIFF_TIMEOUT)
        except FileNotFoundError:
            return None


def _describe(failure: BaseExportFailed) -> str:
    if failure.code == TIMED_OUT:
        return f"base {failure.step} timed out"
    return f"base {failure.step} exited {failure.code}"


def main(run: Run = default_run) -> int:
    if os.environ.get("GITHUB_EVENT_NAME") != "pull_request":
        print("api_breaks: SKIP, not a pull_request event")
        return 0
    cwd = Path.cwd()
    runner_temp = os.environ.get("RUNNER_TEMP")
    if not runner_temp:
        print("api_breaks: FAIL, RUNNER_TEMP is not set, nowhere safe to write the base spec")
        return 1
    head = cwd / SPEC_PATH
    if not head.is_file() or head.stat().st_size == 0:
        print(
            f"api_breaks: FAIL, {SPEC_PATH} is not in the workspace; "
            "scripts.docs.generate must run first"
        )
        return 1
    try:
        base = generate_base_spec(
            os.environ.get("GITHUB_BASE_REF", ""), cwd, Path(runner_temp), run
        )
    except BaseExportFailed as failure:
        print(f"api_breaks: FAIL, {_describe(failure)}")
        return 1
    if base is BaseSpecMissing.REF_MISSING:
        print("api_breaks: FAIL, the base ref origin/<GITHUB_BASE_REF> is not in the checkout")
        return 1
    if base is BaseSpecMissing.NO_EXPORT_MODULE:
        print(f"api_breaks: SKIP, the base ref has no {EXPORT_MODULE}")
        return 0
    oasdiff_exit = _run_oasdiff(base, cwd, Path(runner_temp), run)
    result = verdict(base, oasdiff_exit, os.environ.get("PR_BODY"))
    print(f"api_breaks: {result.name} (oasdiff exit {oasdiff_exit})")
    return 1 if result is Verdict.FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
