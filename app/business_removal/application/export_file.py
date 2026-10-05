"""The port the use case writes the export file through (docs/adr/0001): the
application layer names what it needs and never imports who provides it. The real
one touches the filesystem (`app/business_removal/adapters/export_file.py`); a fake
stands in for fault injection in the use-case tests of another subtask.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol


class ExportFile(Protocol):
    def prepare(self) -> Path:
        """Resolves the configured export directory, creating it `0o700` if it is
        missing, and refuses with a fixed message if it resolves inside the
        repository or has any group or other permission bit set."""
        ...

    def write_durably(self, name: str, document: dict[str, Any]) -> Path:
        """Creates `name` inside the prepared directory with `O_CREAT|O_EXCL` and
        mode `0o600`, writes `document` as UTF-8 JSON, fsyncs the file and the
        directory, then returns its path. Never overwrites an existing file. On any
        failure after the file was created -- the dump, the flush, the file fsync or
        the directory fsync -- it leaves no file at that path, and the exception the
        caller sees is always the original one, never one raised by that clean-up.
        It never touches a file it did not itself create."""
        ...

    def read_back(self, path: Path) -> dict[str, Any]:
        """Parses `path` from a freshly opened descriptor."""
        ...

    def discard(self) -> None:
        """Removes the file this instance created with `write_durably`, if any.
        Idempotent, never touches a file it did not create, and does nothing once
        `keep()` has been called."""
        ...

    def keep(self) -> None:
        """Marks the file this instance created as kept: the commit is being
        attempted, and from now on `discard()` does nothing."""
        ...
