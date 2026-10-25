"""`main(argv, stdin, stdout)` (the declared seam), over a real database and a real
`FileExportFile`: this subtask's own bug fix, proven end to end. A column that
passes every schema check but holds bytes `json.dump` cannot write makes the real
write fail partway through; the fixed line comes back, no file is left in the
export directory, and not one row changed in either business. A column whose type
the schema check itself refuses (`ColumnType.OTHER`, outside the exclusion set)
makes both modes refuse before anything is read.
"""

from __future__ import annotations

import io
import sqlite3
from pathlib import Path

import pytest

from app.business_removal.adapters.cli import main
from tests.business_removal.adapters.seed import (
    EMAIL_LEAVING,
    PINNED,
    row_counts,
    seed,
    set_env,
)
from tests.business_removal.english_words import baseline_text
from tests.conftest import MovableClock

FAILED_MESSAGE = baseline_text("operator.removal.failed")


def _business_id(db_path: Path, name: str) -> int:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute("SELECT id FROM business WHERE name = ?", (name,)).fetchone()
    assert row is not None
    return int(row[0])


def _all_business_owned_table_names(db_path: Path) -> list[str]:
    with sqlite3.connect(db_path) as connection:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' "
                "AND name NOT IN ('alembic_version', 'business', 'invitation', 'login_guard')"
            ).fetchall()
        ]
        owned = [
            name
            for name in tables
            if any(
                column[1] == "business_id"
                for column in connection.execute(f"PRAGMA table_info({name})").fetchall()
            )
        ]
    return owned + ["business"]


def test_a_write_that_fails_partway_leaves_no_file_and_changes_no_row(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    leaving_id = _business_id(db_path, "La Huerta")
    with sqlite3.connect(db_path) as connection:
        # `value` is declared INTEGER, so this table passes every schema check
        # (`other_type_columns` sees `ColumnType.INTEGER`); the bytes stored in it
        # still reach `json.dump`, which is where the real write fails.
        connection.execute(
            "CREATE TABLE oddity ("
            "id INTEGER PRIMARY KEY, "
            "business_id INTEGER NOT NULL REFERENCES business(id), "
            "name TEXT NOT NULL, "
            "value INTEGER)"
        )
        connection.execute(
            "INSERT INTO oddity (business_id, name, value) VALUES (?, ?, X'00')",
            (leaving_id, "Odd"),
        )
        connection.commit()
    set_env(monkeypatch, db_path, export_dir)
    all_tables = _all_business_owned_table_names(db_path)
    staying_id = _business_id(db_path, "Otro Negocio")
    before = {
        name: (row_counts(db_path, name, leaving_id), row_counts(db_path, name, staying_id))
        for name in all_tables
    }
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout, clock=clock)

    assert result == 1
    assert stdout.getvalue().endswith(FAILED_MESSAGE + "\n")
    assert not export_dir.exists() or list(export_dir.glob("*")) == []
    after = {
        name: (row_counts(db_path, name, leaving_id), row_counts(db_path, name, staying_id))
        for name in all_tables
    }
    assert after == before


def test_a_blob_column_added_later_refuses_both_modes_with_no_file_and_no_change(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    leaving_id = _business_id(db_path, "La Huerta")
    with sqlite3.connect(db_path) as connection:
        connection.execute("ALTER TABLE customer ADD COLUMN raw_blob BLOB")
        connection.commit()
    set_env(monkeypatch, db_path, export_dir)

    dry = main(
        [EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=io.StringIO(), clock=clock
    )
    real_stdout = io.StringIO()
    real = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=real_stdout, clock=clock)

    assert dry == 1
    assert real == 1
    assert "raw_blob" in real_stdout.getvalue()
    assert row_counts(db_path, "customer", leaving_id) == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []
