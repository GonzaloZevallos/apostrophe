"""`main(argv, stdin, stdout)` (the declared seam) over a business with two units: the
removal exports both, deletes both after the products that point at them, and leaves the
staying business's unit alone."""

from __future__ import annotations

import io
import json
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
from tests.conftest import MovableClock


def _id(db_path: Path, name: str) -> int:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute("SELECT id FROM business WHERE name = ?", (name,)).fetchone()
    assert row is not None
    return int(row[0])


def test_removing_a_business_with_two_units_exports_and_deletes_both(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    leaving = _id(db_path, "La Huerta")
    staying = _id(db_path, "Otro Negocio")
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO unit (business_id, name, name_key, label, decimals) "
            "VALUES (?, 'pieces', 'pieces', 'pc', 0)",
            (leaving,),
        )
    assert row_counts(db_path, "unit", leaving) == 2
    staying_before = row_counts(db_path, "unit", staying)

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 0
    document = json.loads(next(export_dir.glob("*.json")).read_text())
    assert sorted(record["name"] for record in document["kinds"]["unit"]) == ["pieces", "unit"]
    assert row_counts(db_path, "unit", leaving) == 0
    assert row_counts(db_path, "variety", leaving) == 0
    assert row_counts(db_path, "unit", staying) == staying_before
