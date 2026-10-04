"""`FileExportFile`, the real `ExportFile` port, in `tmp_path` (the plan's seam):
permissions, never overwriting, the repository-root and loose-permission refusals,
and that a round trip returns what was written."""

import os
import stat
from pathlib import Path

import pytest

from app.business_removal.adapters.export_file import (
    REPO_ROOT,
    ExportDirectoryRefused,
    ExportFileAlreadyExists,
    FileExportFile,
)


def test_write_durably_creates_a_file_with_owner_only_permissions(tmp_path: Path) -> None:
    export_file = FileExportFile(tmp_path / "exports")
    export_file.prepare()

    path = export_file.write_durably("business.json", {"a": 1})

    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_write_durably_never_overwrites_an_existing_file(tmp_path: Path) -> None:
    export_file = FileExportFile(tmp_path / "exports")
    export_file.prepare()
    export_file.write_durably("business.json", {"a": 1})

    with pytest.raises(ExportFileAlreadyExists):
        export_file.write_durably("business.json", {"a": 2})


def test_read_back_returns_what_was_written(tmp_path: Path) -> None:
    export_file = FileExportFile(tmp_path / "exports")
    export_file.prepare()
    document = {"business": {"id": 1, "name": "La Flor"}, "kinds": {}}
    path = export_file.write_durably("business.json", document)

    assert export_file.read_back(path) == document


def test_prepare_creates_a_missing_directory_as_owner_only(tmp_path: Path) -> None:
    export_dir = tmp_path / "fresh" / "exports"
    export_file = FileExportFile(export_dir)

    resolved = export_file.prepare()

    assert stat.S_IMODE(resolved.stat().st_mode) == 0o700


def test_prepare_refuses_a_directory_inside_the_repository_root() -> None:
    export_file = FileExportFile(REPO_ROOT / "tmp-export-dir-should-be-refused")

    with pytest.raises(ExportDirectoryRefused):
        export_file.prepare()


def test_prepare_refuses_a_directory_inside_web_dist() -> None:
    export_file = FileExportFile(REPO_ROOT / "web" / "dist" / "exports")

    with pytest.raises(ExportDirectoryRefused):
        export_file.prepare()


def test_prepare_refuses_a_directory_open_to_group_or_other(tmp_path: Path) -> None:
    export_dir = tmp_path / "loose"
    export_dir.mkdir()
    os.chmod(export_dir, 0o755)

    export_file = FileExportFile(export_dir)

    with pytest.raises(ExportDirectoryRefused):
        export_file.prepare()
