"""Packs the generated docs the `docs` job wrote, for the `regen` job to commit.

`python -m scripts.docs.regen_pack --out DIR` writes two files into DIR:

- `owned-paths.txt`: the lines of `owned_paths(REPO_ROOT)`, one a line;
- `owned-docs.tar`: every file that exists under those paths, deterministic (relative POSIX names
  sorted, mode 0644, uid and gid 0, mtime 0), so the same docs always give the same bytes.

`scripts/docs/regen-publish.sh` reads both. An entry ending in `/**` is a directory, every regular
file strictly under it; any other entry is exactly that file. `_files` is the one place that rule is
applied. A symlink under an owned path, or a file with an execute bit, is refused: the publish step
accepts neither. Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import argparse
import sys
import tarfile
from collections.abc import Sequence
from pathlib import Path

from scripts.docs.owned_paths import owned_paths
from scripts.docs.tools import REPO_ROOT

PATHS_FILE = "owned-paths.txt"
TAR_FILE = "owned-docs.tar"
DIR_SUFFIX = "/**"
FILE_MODE = 0o644


class PackError(Exception):
    """An owned path holds something the publish step must not commit."""


def _checked(root: Path, path: Path) -> Path:
    """`path` itself when it may be packed; raises on a symlink."""
    if path.is_symlink():
        raise PackError(f"{path.relative_to(root).as_posix()}: a symlink under an owned path")
    return path


def _files(root: Path, entry: str) -> list[Path]:
    """The regular files `entry` covers under `root`; a missing path covers nothing."""
    if entry.endswith(DIR_SUFFIX):
        base = _checked(root, root / entry.removesuffix(DIR_SUFFIX))
        if not base.is_dir():
            return []
        found: list[Path] = []
        for path in sorted(base.rglob("*")):
            if _checked(root, path).is_file():
                found.append(path)
        return found
    path = _checked(root, root / entry)
    return [path] if path.is_file() else []


def _member(root: Path, path: Path) -> tarfile.TarInfo:
    name = path.relative_to(root).as_posix()
    status = path.stat()
    if status.st_mode & 0o111:
        raise PackError(f"{name}: an executable file under an owned path")
    info = tarfile.TarInfo(name)
    info.size = status.st_size
    info.mode = FILE_MODE
    info.uid = info.gid = 0
    info.uname = info.gname = ""
    info.mtime = 0
    return info


def pack(root: Path, out: Path) -> None:
    """Writes `owned-paths.txt` and `owned-docs.tar` for the owned paths under `root` into `out`."""
    entries = owned_paths(root)
    files: dict[str, Path] = {}
    for entry in entries:
        for path in _files(root, entry):
            files[path.relative_to(root).as_posix()] = path
    members = [(_member(root, files[name]), files[name]) for name in sorted(files)]
    out.mkdir(parents=True, exist_ok=True)
    (out / PATHS_FILE).write_text("".join(f"{entry}\n" for entry in entries), encoding="utf-8")
    with tarfile.open(out / TAR_FILE, "w", format=tarfile.GNU_FORMAT) as archive:
        for info, path in members:
            with path.open("rb") as content:
                archive.addfile(info, content)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="regen_pack", description=__doc__)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        pack(REPO_ROOT, args.out)
    except PackError as error:
        print(f"regen_pack: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
