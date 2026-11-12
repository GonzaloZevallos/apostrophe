"""Warns, on a pull request, about generated output the branch committed (GH-708, GH-692 phase B).

Master regenerates `docs/architecture/generated/**`, `docs/api/**` and
`docs/architecture/decisiones.md` after each merge, so a feature pull request never commits them.
`annotations` is pure; `main` diffs HEAD against its merge-base with the base ref and prints the
GitHub `::warning` lines. The guard warns and never fails: every git failure is one warning and
the exit status is always 0. What is owned is decided only by `writer.is_owned`. Imports nothing
from `app` or `tests`.
"""

from __future__ import annotations

import subprocess
import sys
from collections.abc import Iterable
from pathlib import PurePosixPath

from scripts.docs.writer import is_owned

_MESSAGE = (
    "master regenerates this file after each merge; restore it from the merge-base with master "
    "instead of committing it in this pull request"
)


def annotations(changed: Iterable[str]) -> list[str]:
    """One `::warning file=<path>::` line for each changed path the generator owns."""
    return [
        f"::warning file={path}::{_MESSAGE}" for path in changed if is_owned(PurePosixPath(path))
    ]


def _git(*args: str) -> str | None:
    """The stdout of `git <args>`, or `None` when git cannot run or exits non-zero."""
    try:
        done = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    except OSError:
        return None
    return done.stdout if done.returncode == 0 else None


def main(base_ref: str = "origin/master") -> int:
    """Print the warnings for what HEAD changed since its merge-base with `base_ref`; return 0."""
    base = _git("merge-base", base_ref, "HEAD")
    if base is None or not base.strip():
        print("::warning::owned-path guard: git merge-base failed")
        return 0
    names = _git("diff", "--name-only", base.strip(), "HEAD")
    if names is None:
        print("::warning::owned-path guard: git diff failed")
        return 0
    for line in annotations(names.splitlines()):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
