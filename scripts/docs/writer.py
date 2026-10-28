"""What the generator owns on disk. Imports nothing from `app` or `tests`."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path, PurePosixPath

from scripts.docs.text import HEADER

OWNED_ROOTS = (PurePosixPath("docs/architecture/generated"), PurePosixPath("docs/api"))
OPENAPI_PATH = PurePosixPath("docs/api/openapi.json")


def _owned(path: PurePosixPath) -> bool:
    if path.is_absolute() or ".." in path.parts:
        return False
    return any(path != root and path.is_relative_to(root) for root in OWNED_ROOTS)


def _has_header(path: Path) -> bool:
    try:
        return path.read_bytes().decode("utf-8").startswith(HEADER)
    except UnicodeDecodeError:
        return False


def write_tree(repo_root: Path, outputs: Mapping[PurePosixPath, str]) -> None:
    """Write `outputs` (repo-relative path to text) and remove what an earlier run left behind.

    Raises `ValueError` before writing anything if a key is outside `docs/architecture/generated/`
    and `docs/api/`. Files are written in sorted path order. Under the two roots a file the
    run did not produce is deleted only if it starts with `HEADER`, or is exactly
    `docs/api/openapi.json`. Nothing outside the roots is touched.
    """
    refused = sorted(str(path) for path in outputs if not _owned(path))
    if refused:
        raise ValueError(f"outside the generator's roots: {', '.join(refused)}")
    for path in sorted(outputs):
        target = repo_root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(outputs[path].encode("utf-8"))
    for root in OWNED_ROOTS:
        base = repo_root / root
        if not base.is_dir():
            continue
        for found in sorted(base.rglob("*")):
            relative = PurePosixPath(found.relative_to(repo_root).as_posix())
            if not found.is_file() or relative in outputs:
                continue
            if relative == OPENAPI_PATH or _has_header(found):
                found.unlink()
        for directory in sorted((d for d in base.rglob("*") if d.is_dir()), reverse=True):
            if not any(directory.iterdir()):
                directory.rmdir()
