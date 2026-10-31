"""The products an accepted import creates take the "grams" / "g" / 2 unit, found or added
once, and the business's default "unit" stays as it was. Driven through `cli.run`, which
wraps the import use case, over the movable clock."""

from __future__ import annotations

import io
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.spreadsheet_import.adapters.cli import run
from tests.conftest import OPERATOR_TEXT_EN, MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)


def _import(engine: Engine, business_id: int, clock: MovableClock, tmp_path: Path) -> int:
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    return run(
        [str(business_id), str(xlsx), "--mapping", str(mapping)],
        engine=engine,
        clock=clock,
        out=io.StringIO(),
        err=io.StringIO(),
        text=OPERATOR_TEXT_EN,
    )


def test_every_imported_product_takes_one_grams_unit_beside_the_default_one(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)

    assert _import(engine, business_id, clock, tmp_path) == 0

    with engine.connect() as connection:
        units = connection.execute(
            text("SELECT name, label, decimals FROM unit WHERE business_id = :b ORDER BY id"),
            {"b": business_id},
        ).all()
        used = connection.execute(
            text(
                "SELECT DISTINCT unit.name FROM variety JOIN unit ON unit.id = variety.unit_id "
                "WHERE variety.business_id = :b"
            ),
            {"b": business_id},
        ).all()
    assert [tuple(unit) for unit in units] == [("unit", "unit", 0), ("grams", "g", 2)]
    assert [row[0] for row in used] == ["grams"]
