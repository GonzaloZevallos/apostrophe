"""Business removal over the migrated schema (the declared seam): the leaving
business's settings row goes, the other's stays, and the export holds both switches."""

import io
import json
import sqlite3
from pathlib import Path

import pytest

from app.business_removal.adapters.cli import main
from tests.business_removal.adapters.seed import CLOCK, EMAIL_LEAVING, seed, set_env


def _settings(db_path: Path) -> dict[str, tuple[int, int]]:
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT business.name, is_bulk_pricing, is_vip_customers "
            "FROM pricing_settings JOIN business ON business.id = pricing_settings.business_id"
        ).fetchall()
    return {name: (bulk, vip) for name, bulk, vip in rows}


def test_removal_deletes_its_settings_row_and_exports_both_switches(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    seed(db_path)
    set_env(monkeypatch, db_path, export_dir)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE pricing_settings SET is_bulk_pricing = 1 "
            "WHERE business_id = (SELECT id FROM business WHERE name = 'La Huerta')"
        )
    assert _settings(db_path) == {"La Huerta": (1, 0), "Otro Negocio": (0, 0)}

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=CLOCK
    )

    assert result == 0
    assert _settings(db_path) == {"Otro Negocio": (0, 0)}
    document = json.loads(next(export_dir.glob("*.json")).read_text())
    [record] = document["kinds"]["pricing_settings"]
    assert record["is_bulk_pricing"] is True
    assert record["is_vip_customers"] is False
