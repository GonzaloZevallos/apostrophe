"""The arguments of CI's vitest step (GH-476, ADR-0064 §6): which test files a pull request runs.

`vitest_args` is a pure function over the `changes` job's outputs and the output of
`vitest list --filesOnly` (the tests related to the changed sources), run by the workflow in its
own step. This script runs no node tool and no git. Every path a fork can influence is checked
with `is_safe_path`; anything that fails, and an empty selection, is a full run, which is no
arguments at all.

    ci_vitest.py <listed file>      env VITEST_ALL, VITEST_CHANGED, VITEST_FILES (a JSON list)
                                    prints `args=<paths>` for `$GITHUB_OUTPUT`
"""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Final

from scripts.ci_changes import is_safe_path

WEB_PREFIX: Final = "web/"
_WEB_SRC: Final = "/web/src/"


def _web_relative(raw: str, *, repo_relative: bool) -> str | None:
    """A path below `web/`, or `None` for a blank line or a path outside it. `repo_relative` paths
    must start with `web/`; a listed path may also be absolute or already web-relative."""
    path = raw.strip()
    if not path or ".." in path.split("/"):
        return None
    if path.startswith(WEB_PREFIX):
        return path.removeprefix(WEB_PREFIX) or None
    if repo_relative:
        return None
    if path.startswith("/"):
        _, found, below = path.partition(_WEB_SRC)
        return f"src/{below}" if found and below else None
    return path


def vitest_args(
    vitest_all: bool,
    vitest_changed: bool,
    files: Sequence[str],
    listed: Sequence[str],
) -> list[str]:
    """The test files to hand vitest: nothing (a full run) for a full selection, an empty union
    or any unsafe path; otherwise the sorted, deduplicated union of `files` (repo-relative
    `web/...`) and `listed` (vitest's own listing), as web-relative paths.

    `vitest_changed` says a source changed, which is what makes `listed` mean anything; the union
    takes the listing as it comes, so a stale one can only widen the run."""
    if vitest_all:
        return []
    found = {_web_relative(path, repo_relative=True) for path in files}
    found |= {_web_relative(path, repo_relative=False) for path in listed}
    paths = sorted(path for path in found if path is not None)
    if not paths or not all(is_safe_path(path) for path in paths):
        return []
    return paths


def _flag(value: str | None, *, default: bool) -> bool:
    return default if value is None else value == "true"


def _files(raw: str | None) -> list[str] | None:
    """The `VITEST_FILES` JSON list; `None` when it is not a list of strings."""
    if raw is None:
        return []
    try:
        parsed: object = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        return None
    return [item for item in parsed if isinstance(item, str)]


def main(argv: Sequence[str], env: Mapping[str, str] | None = None) -> int:
    """Reads the listing at `argv[0]` (a missing file is empty) and the environment, and prints
    one `args=` line. A missing `VITEST_ALL` or a malformed `VITEST_FILES` is a full run."""
    source = os.environ if env is None else env
    listed = (
        Path(argv[0]).read_text(encoding="utf-8").splitlines()
        if argv and Path(argv[0]).is_file()
        else []
    )
    files = _files(source.get("VITEST_FILES"))
    vitest_all = _flag(source.get("VITEST_ALL"), default=True)
    args = (
        []
        if files is None
        else vitest_args(
            vitest_all, _flag(source.get("VITEST_CHANGED"), default=False), files, listed
        )
    )
    print(f"args={' '.join(args)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
