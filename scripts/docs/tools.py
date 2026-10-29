"""How the docs generator calls pyreverse, paracelsus, depcruise and redocly.

All are command-line tools, so they run as subprocesses and are never imported. depcruise
and redocly are node tools pinned in web/package.json and run from `web/node_modules/.bin`,
never through npx or the PATH.
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
from pathlib import Path, PurePosixPath
from typing import Literal

REPO_ROOT = Path(__file__).resolve().parents[2]
ER_BASE = "scripts.docs.er_base:ErBase"
OPENAPI_INPUT = "openapi.json"
NODE_BIN = "web/node_modules/.bin"
REDOCLY_ENV = {"REDOCLY_TELEMETRY": "off", "REDOCLY_SUPPRESS_UPDATE_NOTICE": "true"}


class ToolError(Exception):
    """A tool exited non-zero or did not leave the file it should."""


@dataclass(frozen=True)
class ToolCall:
    """One tool run. `name` is unique within a batch; results are gathered in sorted name order.

    pyreverse: `label` is its `-p` project name, `targets` the repo-relative paths it
    analyses, and `product` the file it leaves in its temp dir (`classes_<label>.mmd` or
    `packages_<label>.mmd`). paracelsus: `label` is unused, `targets` is the one
    `module:attribute` of the object that carries the metadata, and its output is stdout.
    depcruise: `label` is its `--include-only` regex (anchored at `^src/`), `targets` the
    paths under `web/src` it cruises, `collapse` an optional `--collapse` regex, and its
    output is stdout. redocly: `inputs` holds the OpenAPI text and `product` is `index.html`.

    `cwd` is the repo-relative directory the tool runs in. `inputs` are (relative name,
    text) pairs written into the call's temp dir before the run.
    """

    name: str
    tool: Literal["pyreverse", "paracelsus", "depcruise", "redocly"]
    label: str
    targets: tuple[str, ...]
    product: str = ""
    cwd: str = "."
    inputs: tuple[tuple[str, str], ...] = ()
    collapse: str = ""

    def __post_init__(self) -> None:
        if not _repo_relative(self.cwd):
            raise ValueError(f"{self.name}: cwd must be repo-relative, got {self.cwd!r}")
        for name, _text in self.inputs:
            if not _repo_relative(name) or name == ".":
                raise ValueError(f"{self.name}: input names must be relative, got {name!r}")


def _repo_relative(path: str) -> bool:
    """True for a non-empty path that is not absolute and never climbs out with `..`."""
    return bool(path) and not path.startswith("/") and ".." not in PurePosixPath(path).parts


RunTool = Callable[[ToolCall], str]


def pyreverse_call(
    name: str, label: str, targets: Sequence[str], diagram: Literal["classes", "packages"]
) -> ToolCall:
    return ToolCall(name, "pyreverse", label, tuple(targets), f"{diagram}_{label}.mmd")


def paracelsus_call(name: str, base: str = ER_BASE) -> ToolCall:
    return ToolCall(name, "paracelsus", "", (base,))


def depcruise_call(
    name: str, targets: Sequence[str], include_only: str, collapse: str | None = None
) -> ToolCall:
    """A depcruise run from `web/`; `include_only` must keep node_modules out of the graph."""
    if not include_only.startswith("^src/"):
        raise ValueError(f"{name}: include-only must be anchored at ^src/, got {include_only!r}")
    return ToolCall(
        name, "depcruise", include_only, tuple(targets), cwd="web", collapse=collapse or ""
    )


def redocly_call(name: str, openapi_text: str) -> ToolCall:
    return ToolCall(
        name, "redocly", "", (OPENAPI_INPUT,), "index.html", inputs=((OPENAPI_INPUT, openapi_text),)
    )


def tool_env(base: Mapping[str, str] | None = None) -> dict[str, str]:
    """The environment of every call: the caller's own plus the two variables that fix output."""
    return {**(os.environ if base is None else base), "PYTHONPATH": ".", "PYTHONHASHSEED": "0"}


def tool_path(program: str) -> str:
    """The tool installed beside the running interpreter, so no PATH lookup decides which one."""
    return str(Path(sys.executable).parent / program)


def call_env(call: ToolCall, base: Mapping[str, str] | None = None) -> dict[str, str]:
    """`tool_env` plus, for redocly, the two variables that keep it from phoning home."""
    env = tool_env(base)
    return {**env, **REDOCLY_ENV} if call.tool == "redocly" else env


def node_tool_path(repo_root: Path, program: str) -> str:
    """The node tool pinned in web/package.json, so neither npx nor the PATH decides which."""
    return str(repo_root / NODE_BIN / program)


def argv_for(call: ToolCall, out_dir: str, repo_root: Path = REPO_ROOT) -> list[str]:
    """The argv of `call`; `out_dir` is the temp dir, relative to the call's cwd."""
    if call.tool == "depcruise":
        return [
            node_tool_path(repo_root, "depcruise"),
            "--config",
            ".dependency-cruiser.cjs",
            "--output-type",
            "mermaid",
            "--include-only",
            call.label,
            *(["--collapse", call.collapse] if call.collapse else []),
            *call.targets,
        ]
    if call.tool == "redocly":
        return [
            node_tool_path(repo_root, "redocly"),
            "build-docs",
            f"{out_dir}/{OPENAPI_INPUT}",
            "-o",
            f"{out_dir}/{call.product}",
            "--inlineBundle",
            "--config",
            "redocly.yaml",
        ]
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
            cwd = repo_root / call.cwd
            for name, text in call.inputs:
                (Path(tmp) / name).write_text(text, encoding="utf-8")
            done = subprocess.run(
                argv_for(call, os.path.relpath(tmp, cwd), repo_root),
                cwd=cwd,
                env=call_env(call),
                capture_output=True,
                text=True,
                check=False,
            )
            if done.returncode != 0:
                detail = (done.stderr or done.stdout).strip().splitlines()[-1:] or ["no output"]
                raise ToolError(f"{call.name}: {call.tool} exited {done.returncode}: {detail[0]}")
            if call.tool in ("paracelsus", "depcruise"):
                return done.stdout
            produced = Path(tmp) / call.product
            if not produced.is_file():
                raise ToolError(f"{call.name}: {call.tool} left no {call.product}")
            return produced.read_text(encoding="utf-8")

    return run_tool


def worker_count() -> int:
    return min(8, os.cpu_count() or 1)


def node_worker_count() -> int:
    """The cap on concurrent node tools: each cruise is memory-hungry."""
    return min(4, os.cpu_count() or 1)


def run_all(
    calls: Sequence[ToolCall], run_tool: RunTool, max_workers: int | None = None
) -> dict[str, str]:
    """Run `calls` in a thread pool; the result is keyed and ordered by sorted call name.

    Which call finishes first never shows in the result. Every call finishes before the
    first failure, in name order, is raised. `max_workers` caps the pool (default
    `worker_count()`).
    """
    workers = worker_count() if max_workers is None else max_workers
    if workers < 1:
        raise ValueError("max_workers must be at least 1")
    ordered = sorted(calls, key=lambda call: call.name)
    if len({call.name for call in ordered}) != len(ordered):
        raise ValueError("duplicate tool call names")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [(call.name, pool.submit(run_tool, call)) for call in ordered]
    return {name: future.result() for name, future in futures}
