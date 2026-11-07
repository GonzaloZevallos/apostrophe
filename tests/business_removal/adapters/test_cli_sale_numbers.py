"""The Sale number in a business's export (CONTEXT.md: Sale number, docs/adr/0015, 0073):
the export carries `number` on every sale (the reflected schema) and `last_sale_number` on
the business header (read with the business), and the counts still reconcile (a run that
does not reconcile exits non-zero and deletes nothing)."""

from __future__ import annotations

import io
import json
import sqlite3
from pathlib import Path

import pytest

from app.business_removal.adapters.cli import main
from tests.business_removal.adapters.seed import EMAIL_LEAVING, PINNED, seed, set_env
from tests.conftest import MovableClock


def test_the_export_carries_every_sale_number_and_the_counter_and_reconciles(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    with sqlite3.connect(db_path) as connection:
        stored = connection.execute(
            "SELECT sale.number FROM sale JOIN business ON business.id = sale.business_id "
            "WHERE business.name = 'La Huerta' ORDER BY sale.number"
        ).fetchall()
        counter = connection.execute(
            "SELECT last_sale_number FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    numbers = [row[0] for row in stored]
    assert numbers, "the seed records at least one sale"
    assert numbers == list(range(1, len(numbers) + 1))
    assert counter == len(numbers)

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 0
    document = json.loads(next(export_dir.glob("*.json")).read_text())
    assert document["business"]["last_sale_number"] == counter
    exported = document["kinds"]["sale"]
    assert len(exported) == len(numbers)
    assert sorted(record["number"] for record in exported) == numbers
    with sqlite3.connect(db_path) as connection:
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM sale WHERE business_id = ?", (document["business"]["id"],)
            ).fetchone()[0]
            == 0
        )
