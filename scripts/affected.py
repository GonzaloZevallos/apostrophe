"""Affected-only forms of `web-tests` and `web-e2e` (ADR-0037, agentic-system ADR-0046).

`uv run --no-project python scripts/affected.py <vitest|e2e> <base>`: a gate substitutes
`{base}` (the task's base sha) and reads only the exit code. Neither runner's own selection
is sound for this codebase alone, so this wrapper adds what each one cannot see:

- `vitest` runs `--changed=<base>` (after checking that it selects something: vitest itself
  exits 0 on an empty selection), then the guard set: the tests that read the whole tree
  (found from the tree itself on every run, never listed by hand).
- `e2e` runs Playwright's `--only-changed=<base>` only when every changed path is a spec
  or a spec helper and the selection is not empty (Playwright exits 0 on an empty one); any
  other path exits 1 without building, so the gate runs the full form.

An empty change list, a git failure and an empty selection all exit non-zero: the gate then
runs the full check. The wrapper never passes a flag that accepts an empty selection.
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Protocol

REPO_ROOT = Path(__file__).resolve().parents[1]
WEB = REPO_ROOT / "web"

# The files this wrapper depends on: a change to any of them can change what it selects,
# so each must be matched by an `affected_fallback` glob in `.agentic/stack.yaml`.
WRAPPER_INPUTS = (
    "scripts/affected.py",
    "scripts/__init__.py",
    "web/package.json",
    "web/vite.config.ts",
    "web/playwright.config.ts",
    "web/src/test-setup.ts",
)

# A test touching one of these reads the repository, not just its imports, so vitest's
# import graph cannot tell when a change should select it.
GUARD_PATTERNS = (
    r"import\.meta\.glob\b",
    r"\breadFile",
    r"\breaddir",
    r"\bexistsSync",
    r"\?raw\b",
    r"\?url\b",
)
_GUARD = re.compile("|".join(GUARD_PATTERNS))
_RELATIVE_IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*["'](\.{1,2}/[^"']+)["']""")
_PLAYWRIGHT_TOTAL = re.compile(r"^Total: (\d+) tests? in", re.MULTILINE)
_TEST_FILE = re.compile(r"\.test\.tsx?$")
_HELPER_SUFFIXES = ("", ".ts", ".tsx", "/index.ts")


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str


class Runner(Protocol):
    def __call__(
        self, command: Sequence[str], *, capture: bool, cwd: Path = REPO_ROOT
    ) -> CommandResult: ...


def run_command(command: Sequence[str], *, capture: bool, cwd: Path = REPO_ROOT) -> CommandResult:
    """Runs `command` from `cwd` (the checkout root unless a tool must run inside `web/`).
    Captured output is returned; otherwise it goes straight to the terminal, so a runner's
    own report is never rewritten."""
    completed = subprocess.run(
        list(command),
        cwd=cwd,
        capture_output=capture,
        text=True,
        check=False,
    )
    return CommandResult(completed.returncode, completed.stdout if capture else "")


def _say(line: str) -> None:
    print(line, file=sys.stderr)


def changed_paths(base: str, run: Runner) -> list[str]:
    """What changed since `base`: tracked changes of the working tree, without rename
    detection (a rename counts as the old path and the new one), plus untracked files.
    Exits 1 when git fails or when nothing changed, so the gate runs the full check."""
    outputs: list[str] = []
    for command in (
        ["git", "diff", "--name-only", "--no-renames", base],
        ["git", "ls-files", "--others", "--exclude-standard"],
    ):
        result = run(command, capture=True)
        if result.returncode != 0:
            raise SystemExit(1)
        outputs.append(result.stdout)
    paths = sorted({line for output in outputs for line in output.splitlines() if line})
    if not paths:
        _say("affected: nothing changed -> full")
        raise SystemExit(1)
    return paths


def is_e2e_sound(path: str) -> bool:
    """True for the paths whose change Playwright's own import graph follows: a spec and
    the helpers under `web/e2e/helpers/`. Everything else (the backend, the built bundle,
    `env.ts`, ...) is outside what that graph can see."""
    parts = PurePosixPath(path).parts
    if parts[:2] != ("web", "e2e") or len(parts) < 3:
        return False
    return (parts[2] == "helpers" and len(parts) > 3) or path.endswith(".spec.ts")


def _resolve_helper(test: Path, specifier: str) -> Path | None:
    base = test.parent / specifier
    for suffix in _HELPER_SUFFIXES:
        candidate = Path(f"{base}{suffix}")
        if candidate.is_file():
            return candidate
    return None


def _reads_the_tree(test: Path) -> bool:
    text = test.read_text()
    if _GUARD.search(text):
        return True
    for specifier in _RELATIVE_IMPORT.findall(text):
        helper = _resolve_helper(test, specifier)
        if helper is None or _TEST_FILE.search(helper.name):
            continue
        if _GUARD.search(helper.read_text()):
            return True
    return False


def discover_guards(web_src: Path) -> list[str]:
    """Every test under `web_src` that reads the tree: its own text matches a guard
    pattern, or one relative non-test import of it does (one level, no deeper). Errs
    toward running: an extra guard costs seconds, a skipped one hides a failure. Paths
    are relative to `web/`, sorted."""
    web = web_src.parent
    tests = [
        path
        for path in web_src.rglob("*.test.ts*")
        if _TEST_FILE.search(path.name) and path.is_file()
    ]
    return sorted(path.relative_to(web).as_posix() for path in tests if _reads_the_tree(path))


def _vitest(base: str, run: Runner) -> int:
    changed_paths(base, run)
    # `vitest run --changed` exits 0 when it selects no test file ("No test files found,
    # exiting with code 0"), so the selection is listed first and an empty one exits 1.
    listed = run(
        ["npx", "--no-install", "vitest", "list", f"--changed={base}", "--filesOnly"],
        capture=True,
        cwd=WEB,
    )
    if listed.returncode != 0:
        return listed.returncode
    if not listed.stdout.strip():
        _say("affected: nothing selected -> full")
        return 1
    _say("affected: changed")
    selected = run(["npm", "--prefix", "web", "test", "--", f"--changed={base}"], capture=False)
    if selected.returncode != 0:
        return selected.returncode
    guards = discover_guards(REPO_ROOT / "web" / "src")
    _say(f"affected: guards ({len(guards)} files)")
    return run(["npm", "--prefix", "web", "test", "--", *guards], capture=False).returncode


def _e2e(base: str, run: Runner) -> int:
    paths = changed_paths(base, run)
    if not all(is_e2e_sound(path) for path in paths):
        _say("affected: unsound -> full")
        return 1
    # `playwright test --only-changed` exits 0 when it selects no test, so the selection is
    # listed first (no build, no server) and an empty one exits 1.
    listed = run(
        ["npx", "--no-install", "playwright", "test", "--list", f"--only-changed={base}"],
        capture=True,
        cwd=WEB,
    )
    if listed.returncode != 0:
        return listed.returncode
    total = _PLAYWRIGHT_TOTAL.search(listed.stdout)
    if total is None or int(total.group(1)) == 0:
        _say("affected: nothing selected -> full")
        return 1
    _say("affected: e2e-only -> playwright --only-changed")
    return run(
        ["npm", "--prefix", "web", "run", "e2e", "--", f"--only-changed={base}"],
        capture=False,
    ).returncode


def main(argv: Sequence[str], run: Runner = run_command) -> int:
    if len(argv) != 2 or argv[0] not in ("vitest", "e2e") or argv[1].startswith("-"):
        _say("usage: affected.py <vitest|e2e> <base>")
        return 2
    command, base = argv
    return _vitest(base, run) if command == "vitest" else _e2e(base, run)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
