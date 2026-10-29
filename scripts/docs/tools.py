"""How the docs generator calls pyreverse and paracelsus.

Both are untyped command-line tools, so they run as subprocesses and are never imported.
Every call is an argv list (never a shell), runs with `cwd` at the repo root, with
`PYTHONPATH=.` and `PYTHONHASHSEED=0`, and only repo-relative paths in its arguments. A
call that writes files gets its own temp dir, removed afterwards; nothing is written into
the cwd. Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

REPO_ROOT = Path(__file__).resolve().parents[2]
ER_BASE = "scripts.docs.er_base:ErBase"


class ToolError(Exception):
    """A tool exited non-zero or did not leave the file it should."""


@dataclass(frozen=True)
class ToolCall:
    """One tool run. `name` is unique within a batch; results are gathered in sorted name order.

    pyreverse: `label` is its `-p` project name, `targets` the repo-relative paths it
    analyses, and `product` the file it leaves in its temp dir (`classes_<label>.mmd` or
    `packages_<label>.mmd`). paracelsus: `label` is unused, `targets` is the one
    `module:attribute` of the object that carries the metadata, and its output is stdout.
    """

    name: str
    tool: Literal["pyreverse", "paracelsus"]
    label: str
    targets: tuple[str, ...]
    product: str = ""


RunTool = Callable[[ToolCall], str]


def pyreverse_call(
    name: str, label: str, targets: Sequence[str], diagram: Literal["classes", "packages"]
) -> ToolCall:
    return ToolCall(name, "pyreverse", label, tuple(targets), f"{diagram}_{label}.mmd")


def paracelsus_call(name: str, base: str = ER_BASE) -> ToolCall:
    return ToolCall(name, "paracelsus", "", (base,))


def tool_env(base: Mapping[str, str] | None = None) -> dict[str, str]:
    """The environment of every call: the caller's own plus the two variables that fix output."""
    return {**(os.environ if base is None else base), "PYTHONPATH": ".", "PYTHONHASHSEED": "0"}


def tool_path(program: str) -> str:
    """The tool installed beside the running interpreter, so no PATH lookup decides which one."""
    return str(Path(sys.executable).parent / program)


def argv_for(call: ToolCall, out_dir: str) -> list[str]:
    """The argv of `call`; `out_dir` is the repo-relative temp dir pyreverse writes into."""
    if call.tool == "paracelsus":
        return [
            tool_path("paracelsus"),
            "graph",
            *call.targets,
            "--format",
            "mermaid",
            "--column-sort",
            "preserve-order",
        ]
    return [
        tool_path("pyreverse"),
        "-o",
        "mmd",
        "--filter-mode",
        "PUB_ONLY",
        "--show-ancestors",
        "0",
        "--show-associated",
        "0",
        "-d",
        out_dir,
        "-p",
        call.label,
        *call.targets,
    ]


def subprocess_runner(repo_root: Path = REPO_ROOT) -> RunTool:
    """The production `run_tool`: one subprocess per call, its files in a temp dir it removes."""

    def run_tool(call: ToolCall) -> str:
        with tempfile.TemporaryDirectory(prefix="docs-gen-") as tmp:
            out_dir = os.path.relpath(tmp, repo_root)
            done = subprocess.run(
                argv_for(call, out_dir),
                cwd=repo_root,
                env=tool_env(),
                capture_output=True,
                text=True,
                check=False,
            )
            if done.returncode != 0:
                detail = (done.stderr or done.stdout).strip().splitlines()[-1:] or ["no output"]
                raise ToolError(f"{call.name}: {call.tool} exited {done.returncode}: {detail[0]}")
            if call.tool == "paracelsus":
                return done.stdout
            produced = Path(tmp) / call.product
            if not produced.is_file():
                raise ToolError(f"{call.name}: pyreverse left no {call.product}")
            return produced.read_text(encoding="utf-8")

    return run_tool


def worker_count() -> int:
    return min(8, os.cpu_count() or 1)


def run_all(calls: Sequence[ToolCall], run_tool: RunTool) -> dict[str, str]:
    """Run `calls` in a thread pool; the result is keyed and ordered by sorted call name.

    Which call finishes first never shows in the result. Every call finishes before the
    first failure, in name order, is raised.
    """
    ordered = sorted(calls, key=lambda call: call.name)
    if len({call.name for call in ordered}) != len(ordered):
        raise ValueError("duplicate tool call names")
    with ThreadPoolExecutor(max_workers=worker_count()) as pool:
        futures = [(call.name, pool.submit(run_tool, call)) for call in ordered]
    return {name: future.result() for name, future in futures}
