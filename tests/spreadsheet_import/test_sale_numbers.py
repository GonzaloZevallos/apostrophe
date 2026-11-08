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
    """Four sale rows: 10 January on row 2 (a total of SALE_TOTAL), 5 January on row 3, 10
    January again on row 4 (twice that total, so the two are told apart) and 12 January on
    row 5."""
    workbook = _workbook(sale_date=date(2026, 1, 10))
    ventas = workbook[layout.VENTAS_SHEET]
    for row, day, grams in (
        (3, date(2026, 1, 5), 10),
        (4, date(2026, 1, 10), 20),
        (5, date(2026, 1, 12), 10),
    ):
        ventas.cell(row=row, column=1, value=day)
        ventas.cell(row=row, column=2, value=VARIETY)
        ventas.cell(row=row, column=3, value=grams)
        ventas.cell(row=row, column=4, value="Pendiente")
        ventas.cell(row=row, column=5, value=SALE_TOTAL * grams // 10)
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


def _numbered(client: TestClient) -> list[tuple[int, str, int]]:
    """(number, date, total) of every sale, in number order."""
    return sorted((row["number"], row["date"], row["total"]) for row in client.get("/sales").json())


def test_imported_sales_are_numbered_by_date_then_sheet_row(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    assert _import(engine, clock, tmp_path) == 0

    # The two sales of 10 January keep their sheet order: row 2 (SALE_TOTAL) before row 4.
    assert _numbered(client) == [
        (1, "2026-01-05", SALE_TOTAL),
        (2, "2026-01-10", SALE_TOTAL),
        (3, "2026-01-10", 2 * SALE_TOTAL),
        (4, "2026-01-12", SALE_TOTAL),
    ]


def _record_and_delete_two_sales(client: TestClient) -> None:
    """A business that once gave two numbers: it records two sales, deletes both and
    deletes its product, so it holds no record any more and the import may run."""
    product = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    for _ in range(2):
        sale = client.post(
            "/sales",
            json={"payment": "cash", "lines": [{"product_id": product["id"], "quantity": "1"}]},
        ).json()
        assert client.delete(f"/sales/{sale['id']}").status_code == 200
    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.get("/sales").json() == []


def test_an_import_into_a_business_that_deleted_every_sale_continues_from_its_counter(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    _record_and_delete_two_sales(client)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT last_sale_number FROM business")).scalar_one() == 2

    assert _import(engine, clock, tmp_path) == 0

    assert [number for number, _, _ in _numbered(client)] == [3, 4, 5, 6]
    with engine.connect() as connection:
        counter = connection.execute(text("SELECT last_sale_number FROM business")).scalar_one()
    assert counter == 6
