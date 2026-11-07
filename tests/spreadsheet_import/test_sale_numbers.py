"""The Sale numbers an import gives (CONTEXT.md: Sale number, docs/adr/0073, docs/adr/0018):
the import writes through the sales use case, so its sales are numbered by date and then by
sheet row, continuing from the highest number the business ever gave. Driven through
`cli.run` on the movable clock and read back through the HTTP API."""

from __future__ import annotations

import io
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import OPERATOR_TEXT_EN, MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    SALE_TOTAL,
    VARIETY,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)


def _with_sales_out_of_date_order() -> Workbook:
    """Three sale rows: 10 January on row 2, then 5 January, then 12 January."""
    workbook = _workbook(sale_date=date(2026, 1, 10))
    ventas = workbook[layout.VENTAS_SHEET]
    for row, day in ((3, date(2026, 1, 5)), (4, date(2026, 1, 12))):
        ventas.cell(row=row, column=1, value=day)
        ventas.cell(row=row, column=2, value=VARIETY)
        ventas.cell(row=row, column=3, value=10)
        ventas.cell(row=row, column=4, value="Pendiente")
        ventas.cell(row=row, column=5, value=SALE_TOTAL)
        ventas.cell(row=row, column=6, value=CUSTOMER)
        ventas.cell(row=row, column=7, value="")
    return workbook


def _import(engine: Engine, clock: MovableClock, tmp_path: Path) -> int:
    xlsx = _save_workbook(_with_sales_out_of_date_order(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    business_id = _business_id(engine)
    return run(
        [str(business_id), str(xlsx), "--mapping", str(mapping)],
        engine=engine,
        clock=clock,
        out=io.StringIO(),
        err=io.StringIO(),
        text=OPERATOR_TEXT_EN,
    )


def _numbers_by_date(client: TestClient) -> dict[str, int]:
    return {row["date"]: row["number"] for row in client.get("/sales").json()}


def test_imported_sales_are_numbered_by_date_then_sheet_row(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    assert _import(engine, clock, tmp_path) == 0

    assert _numbers_by_date(client) == {"2026-01-05": 1, "2026-01-10": 2, "2026-01-12": 3}


def test_an_import_into_a_business_that_deleted_every_sale_continues_from_its_counter(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    # A business that once gave five numbers and deleted all of those sales.
    with engine.begin() as connection:
        connection.execute(text("UPDATE business SET last_sale_number = 5"))

    assert _import(engine, clock, tmp_path) == 0

    assert _numbers_by_date(client) == {"2026-01-05": 6, "2026-01-10": 7, "2026-01-12": 8}
    with engine.connect() as connection:
        counter = connection.execute(text("SELECT last_sale_number FROM business")).scalar_one()
    assert counter == 8
