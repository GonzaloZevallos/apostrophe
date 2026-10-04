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
        directory, then returns its path. Never overwrites an existing file."""
        ...

    def read_back(self, path: Path) -> dict[str, Any]:
        """Parses `path` from a freshly opened descriptor."""
        ...

    def remove(self, path: Path) -> None:
        """Removes `path`. Called only before a commit (the plan's invariant)."""
        ...
