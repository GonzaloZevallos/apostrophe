"""The removal command exports the business's `money_format` row (ADR-0058, ADR-0015): a
business opened through the real opening path leaves one record `{symbol, decimals,
scale}` in the export, counted and deleted like every other table."""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

import pytest

from app.business_removal.adapters.cli import main
from tests.business_removal.adapters.seed import (
    EMAIL_LEAVING,
    EXPENSE_AMOUNT,
    PAYMENT_AMOUNT,
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


def _export_at(
    scale: int, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[dict[str, Any], str, int]:
    """Removes the business `seed` opened at `scale`; the export it wrote, the command's
    output and its exit code."""
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock, money_scale=scale)
    set_env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout, clock=clock)

    (export,) = export_dir.glob("*.json")
    document: dict[str, Any] = json.loads(export.read_text())
    return document, stdout.getvalue(), result


@pytest.mark.parametrize("scale", [0, 2])
def test_the_export_states_the_business_money_beside_its_tables(
    scale: int, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document, output, result = _export_at(scale, tmp_path, monkeypatch)

    assert result == 0, output
    assert document["money"] == {"scale": scale, "decimals": 0}
    assert document["kinds"]["money_format"][0]["scale"] == scale
    # The row is counted among the rows exported and deleted, like every table.
    assert any("money_format" in line and "1" in line for line in output.splitlines())


@pytest.mark.parametrize("scale", [0, 2])
def test_the_export_amounts_are_the_stored_integers_at_the_business_scale(
    scale: int, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document, _output, result = _export_at(scale, tmp_path, monkeypatch)

    assert result == 0
    (payment,) = document["kinds"]["payment"]
    (expense,) = document["kinds"]["expense"]
    # Read with the block's scale, the export gives back the amount entered (ADR-0058).
    factor = 10 ** document["money"]["scale"]
    assert payment["amount"] == PAYMENT_AMOUNT * factor
    assert expense["amount"] == EXPENSE_AMOUNT * factor
