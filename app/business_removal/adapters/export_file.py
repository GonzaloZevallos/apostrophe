"""The real `ExportFile` port (`app/business_removal/application/export_file.py`):
creates, writes, fsyncs, reads back and removes the export file and its directory.
Its own exceptions carry fixed messages only -- never an OS message, which might
repeat a path or a cause this module does not control.
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Any

from app.business_removal.application.signals import blocked_signals
from app.business_removal.domain.naming import is_inside

# `.../app/business_removal/adapters/export_file.py` -> repo root, four parents up.
REPO_ROOT = Path(__file__).resolve().parents[3]


class ExportDirectoryRefused(RuntimeError):
    """The configured export directory is unsafe. A fixed message: the path itself
    is not repeated, since nothing here is sure it holds no personal data."""


class ExportFileAlreadyExists(RuntimeError):
    pass


class FileExportFile:
    """Implements `ExportFile` against the real filesystem, under `export_dir`."""

    def __init__(self, export_dir: Path) -> None:
        self._export_dir = export_dir
        self._resolved: Path | None = None
        self._created: Path | None = None
        self._kept = False

    def prepare(self) -> Path:
        resolved = self._export_dir.expanduser().resolve()
        if is_inside(resolved, REPO_ROOT):
            raise ExportDirectoryRefused(
                "the export directory must resolve outside the repository"
            )
        if not resolved.is_dir():
            resolved.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(resolved, 0o700)
        mode = stat.S_IMODE(resolved.stat().st_mode)
        if mode & (stat.S_IRWXG | stat.S_IRWXO):
            raise ExportDirectoryRefused(
                "the export directory must have no group or other permission bits"
            )
        self._resolved = resolved
        return resolved

    def write_durably(self, name: str, document: dict[str, Any]) -> Path:
        if self._resolved is None:
            raise ExportDirectoryRefused("the export directory was never prepared")
        path = self._resolved / name
        with blocked_signals():
            try:
                descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            except FileExistsError as exc:
                raise ExportFileAlreadyExists("the export file already exists") from exc
            self._created = path
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(document, handle, ensure_ascii=False, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            directory_descriptor = os.open(self._resolved, os.O_RDONLY)
            try:
                os.fsync(directory_descriptor)
            finally:
                os.close(directory_descriptor)
        except BaseException:
            try:
                self.discard()
            except BaseException:
                pass
            raise
        return path

    def read_back(self, path: Path) -> dict[str, Any]:
        descriptor = os.open(path, os.O_RDONLY)
        with os.fdopen(descriptor, encoding="utf-8") as handle:
            document: dict[str, Any] = json.load(handle)
        return document

    def discard(self) -> None:
        if self._kept or self._created is None:
            return
        created = self._created
        self._created = None
        created.unlink(missing_ok=True)

    def keep(self) -> None:
        self._kept = True
