"""The front module graph: which `web/src` folders get a diagram and which depcruise runs draw them.

Pure functions over paths and text; the depcruise runs themselves go through the injected
`RunTool` (see `scripts.docs.tools`). Every folder of `web/src` that holds a source file that
is not excluded has its own file under `front-modules/`, plus `root.md` (the files directly
in `src/`) and `overview.md` (the folder-level graph). The exclusion patterns live only in
`web/scripts/docs/front-exclude.json`; this module reads that file and holds none of its own.

The resolver of relative imports follows the same rules as `scripts/affected.py` (`./` and
`../` specifiers; the suffixes `""`, `.ts`, `.tsx` and `/index.ts`) without importing its
private helpers. Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import json
import posixpath
import re
from collections.abc import Collection, Mapping, Sequence
from pathlib import Path

from scripts.docs.tools import ToolCall, depcruise_call

PATTERNS_FILE = "web/scripts/docs/front-exclude.json"
SOURCE_SUFFIXES = (".ts", ".tsx")
NO_MODULES = "No modules in this folder."
SCOPE_NOTE = (
    "Only edges between files inside `{folder}/` are drawn; edges between folders are in "
    "[overview.md](overview.md)."
)
ROOT_NOTE = (
    "Only the files directly in `src/` and the edges between them are drawn; edges between "
    "folders are in [overview.md](overview.md)."
)
OVERVIEW_NOTE = (
    "Each folder of `src/` is one node; the files directly in `src/` are drawn as files."
)
SPLIT_NOTE = "Edges between subfolders are not drawn; see overview.md."

_RESOLVE_SUFFIXES = ("", ".ts", ".tsx", "/index.ts")
_IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}/[^'"]*)['"]""")
_TEST_LIBRARY = re.compile(
    r"""(?:\bfrom\s*|\bimport\s*\(?\s*)['"](?:vitest|@testing-library/[^'"]*)['"]"""
)
_REGEX_SPECIAL = re.compile(r"([.^$*+?()\[\]{}|\\])")


def load_patterns(repo_root: Path) -> list[str]:
    """The exclusion regexes, read from `web/scripts/docs/front-exclude.json`."""
    raw: object = json.loads((repo_root / PATTERNS_FILE).read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
        raise ValueError(f"{PATTERNS_FILE} must be a JSON list of strings")
    return [str(item) for item in raw]


def excluded(path: str, patterns: Sequence[str]) -> bool:
    """Whether `path` (a `src/...` posix string) matches any exclusion pattern."""
    return any(re.search(pattern, path) for pattern in patterns)


def _sources(directory: Path, prefix: str, patterns: Sequence[str], *, deep: bool) -> list[str]:
    found: list[str] = []
    for path in sorted(directory.rglob("*") if deep else directory.glob("*")):
        if path.is_file() and path.suffix in SOURCE_SUFFIXES:
            relative = f"{prefix}/{path.relative_to(directory).as_posix()}"
            if not excluded(relative, patterns):
                found.append(relative)
    return found


def subfolders(directory: Path, prefix: str, patterns: Sequence[str]) -> list[str]:
    """The sorted direct subfolders of `directory` holding a non-excluded source at any depth.

    `prefix` is the posix path of `directory` as the patterns see it (`src/screens`).
    """
    return [
        child.name
        for child in sorted(directory.iterdir())
        if child.is_dir() and _sources(child, f"{prefix}/{child.name}", patterns, deep=True)
    ]


def has_direct_files(directory: Path, prefix: str, patterns: Sequence[str]) -> bool:
    """Whether a non-excluded source sits directly in `directory`."""
    return bool(_sources(directory, prefix, patterns, deep=False))


def front_folders(web_src: Path, patterns: Sequence[str]) -> list[str]:
    """The top-level folders of `web/src` that hold a non-excluded source, sorted."""
    return subfolders(web_src, "src", patterns)


def root_has_files(web_src: Path, patterns: Sequence[str]) -> bool:
    return has_direct_files(web_src, "src", patterns)


# --- the resolver ---------------------------------------------------------------------------


def relative_imports(source: str) -> list[str]:
    """The `./` and `../` specifiers a source imports, in order; packages are not drawn."""
    return _IMPORT.findall(source)


def resolve(importer: str, specifier: str, existing: Collection[str]) -> str | None:
    """The file in `existing` a relative `specifier` of `importer` names, or None."""
    base = posixpath.normpath(posixpath.join(posixpath.dirname(importer), specifier))
    if base.startswith(".."):
        return None
    for suffix in _RESOLVE_SUFFIXES:
        if f"{base}{suffix}" in existing:
            return f"{base}{suffix}"
    return None


def orphans_of_excluded(files: Mapping[str, str], patterns: Sequence[str]) -> list[str]:
    """Non-excluded files that have importers, every one of them excluded.

    Such a file is a test helper the exclusion list missed: it would be drawn, linked to
    nothing the app runs. `files` maps `src/...` paths to their source text.
    """
    importers: dict[str, set[str]] = {}
    for path, source in files.items():
        for specifier in relative_imports(source):
            target = resolve(path, specifier, files.keys())
            if target is not None and target != path:
                importers.setdefault(target, set()).add(path)
    return sorted(
        path
        for path, who in importers.items()
        if not excluded(path, patterns) and all(excluded(i, patterns) for i in who)
    )


def imports_test_libraries(files: Mapping[str, str], patterns: Sequence[str]) -> list[str]:
    """Non-excluded files that import `vitest` or `@testing-library/*`: tests in disguise."""
    return sorted(
        path
        for path, source in files.items()
        if not excluded(path, patterns) and _TEST_LIBRARY.search(source) is not None
    )


# --- the depcruise plan ---------------------------------------------------------------------


def _anchored(folder: str) -> str:
    return _REGEX_SPECIAL.sub(r"\\\1", folder)


def plan_calls(folders: Sequence[str], *, root: bool) -> list[ToolCall]:
    """One cruise per folder, one for the files directly in `src/` if any, and the overview."""
    calls = [
        depcruise_call(f"front/{folder}", [f"src/{folder}"], f"^src/{_anchored(folder)}/")
        for folder in folders
    ]
    if root:
        calls.append(depcruise_call("front/root", ["src"], "^src/[^/]+$"))
    calls.append(depcruise_call("front/overview", ["src"], "^src/", collapse="^src/[^/]+"))
    return calls


def direct_name(folder: str) -> str:
    return f"front/{folder}/(files)"


def split_calls(folder: str, subs: Sequence[str], *, direct: bool) -> list[ToolCall]:
    """The cruises that replace an oversized folder: one per subfolder, one for its own files."""
    calls = [
        depcruise_call(
            f"front/{folder}/{sub}",
            [f"src/{folder}/{sub}"],
            f"^src/{_anchored(folder)}/{_anchored(sub)}/",
        )
        for sub in subs
    ]
    if direct:
        calls.append(
            depcruise_call(
                direct_name(folder), [f"src/{folder}"], f"^src/{_anchored(folder)}/[^/]+$"
            )
        )
    return calls


# --- the file text --------------------------------------------------------------------------


def _fence(cruise: str) -> str:
    return f"```mermaid\n{cruise.strip()}\n```"


def has_modules(cruise: str) -> bool:
    """Whether a cruise draws at least one node (a line with a quoted label, not a group)."""
    return any(
        '["' in line and not line.strip().startswith("subgraph ") for line in cruise.splitlines()
    )


def _section(cruise: str) -> str:
    return _fence(cruise) if has_modules(cruise) else NO_MODULES


def folder_text(folder: str, cruise: str) -> str:
    return f"# {folder}\n\n{SCOPE_NOTE.format(folder=folder)}\n\n{_section(cruise)}"


def split_folder_text(folder: str, sections: Mapping[str, str], direct: str | None) -> str:
    """A folder split by subfolder: one `####` section per subfolder, then its own files."""
    parts = [f"# {folder}", "", SCOPE_NOTE.format(folder=folder), "", SPLIT_NOTE]
    for sub in sorted(sections):
        parts += ["", f"#### {sub}", "", _section(sections[sub])]
    if direct is not None:
        parts += ["", f"#### files directly in {folder}/", "", _section(direct)]
    return "\n".join(parts)


def root_text(cruise: str | None) -> str:
    body = NO_MODULES if cruise is None else _section(cruise)
    return f"# root\n\n{ROOT_NOTE}\n\n{body}"


def overview_text(cruise: str) -> str:
    return f"# overview\n\n{OVERVIEW_NOTE}\n\n{_section(cruise)}"
