"""The removal command exports the business's `money_format` row (ADR-0058, ADR-0015): a
business opened through the real opening path leaves one record `{symbol, decimals,
scale}` in the export, counted and deleted like every other table."""

from __future__ import annotations

import io
import json
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


def test_the_export_carries_the_money_format_row_and_the_run_deletes_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 0
    (export,) = export_dir.glob("*.json")
    document = json.loads(export.read_text())
    records = document["kinds"]["money_format"]
    assert len(records) == 1
    assert (records[0]["symbol"], records[0]["decimals"], records[0]["scale"]) == ("$", 0, 0)
    business_id = document["business"]["id"]
    assert row_counts(db_path, "money_format", business_id) == 0
