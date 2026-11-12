"""What the generator owns on disk. Imports nothing from `app` or `tests`."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path, PurePosixPath

from scripts.docs.text import HEADER

# The strings of `docs.paths` in `.agentic/stack.yaml` (tests/docs/test_owned_paths.py compares
# them). `x/**` is every file strictly under `x`; a bare entry is exactly that file.
OWNED_ROOTS = (
    "docs/architecture/generated/**",
    "docs/api/**",
    "docs/architecture/decisiones.md",
)
_DIRECTORY_SUFFIX = "/**"


def is_owned(path: PurePosixPath) -> bool:
    """Whether the generator may write `path`: under an `x/**` entry or exactly a bare one."""
    if path.is_absolute() or ".." in path.parts:
        return False
    for root in OWNED_ROOTS:
        if root.endswith(_DIRECTORY_SUFFIX):
            base = PurePosixPath(root.removesuffix(_DIRECTORY_SUFFIX))
            if path != base and path.is_relative_to(base):
                return True
        elif path == PurePosixPath(root):
            return True
    return False


def _has_header(path: Path) -> bool:
    try:
        return path.read_bytes().decode("utf-8").startswith(HEADER)
    except UnicodeDecodeError:
        return False


def _remove_if_stale(
    repo_root: Path, relative: PurePosixPath, outputs: Mapping[PurePosixPath, str]
) -> None:
    found = repo_root / relative
    if found.is_file() and relative not in outputs and _has_header(found):
        found.unlink()


def write_tree(repo_root: Path, outputs: Mapping[PurePosixPath, str]) -> None:
    """Write `outputs` (repo-relative path to text) and remove what an earlier run left behind.

    Raises `ValueError` before writing anything if a key is not owned (`OWNED_ROOTS`). Files
    are written in sorted path order. Among the owned paths a file the run did not produce is
    deleted only if it starts with `HEADER`: a file without it, `docs/api/openapi.json` and
    `docs/architecture/decisiones.md` included, survives. Nothing else is touched.
    """
    refused = sorted(str(path) for path in outputs if not is_owned(path))
    if refused:
        raise ValueError(f"outside the generator's roots: {', '.join(refused)}")
    for path in sorted(outputs):
        target = repo_root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(outputs[path].encode("utf-8"))
    for root in OWNED_ROOTS:
        if not root.endswith(_DIRECTORY_SUFFIX):
            _remove_if_stale(repo_root, PurePosixPath(root), outputs)
            continue
        base = repo_root / root.removesuffix(_DIRECTORY_SUFFIX)
        if not base.is_dir():
            continue
        for found in sorted(base.rglob("*")):
            relative = PurePosixPath(found.relative_to(repo_root).as_posix())
            _remove_if_stale(repo_root, relative, outputs)
        for directory in sorted((d for d in base.rglob("*") if d.is_dir()), reverse=True):
            if not any(directory.iterdir()):
                directory.rmdir()
