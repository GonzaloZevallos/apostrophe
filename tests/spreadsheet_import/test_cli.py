"""`cli.run` end to end (CODING_STANDARDS.md section 5): a real `.xlsx` fixture and a
real mapping file, run over the `conftest` engine and movable clock, with the business
opened through the `client` fixture and every figure read back through the HTTP API.
Never by building rows by hand (the plan's seam for this subtask).
"""

from __future__ import annotations

import io
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.migrations.runner import upgrade_to_head
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock

VENTAS_TITLES = (
    "Fecha",
    "Variedad",
    "Gramos",
    "Pago",
    "Total",
    "Cliente",
    "Tipo",
    "Envío cobrado",
    "Precio especial (total)",
    "Nota",
)
ENTRADAS_TITLES = ("Fecha", "Variedad", "Gramos", "Origen", "Costo total", "Nota", "Revisar")
GASTOS_TITLES = ("Fecha", "Categoría", "Monto", "Detalle", "Revisar")

VARIETY = "Jack Herer"
CUSTOMER = "Juan Perez"
PHONE = "1123456789"
SALE_TOTAL = 10_000


def _titles(ws: Worksheet, titles: tuple[str, ...]) -> None:
    for index, title in enumerate(titles, start=1):
        ws.cell(row=layout.TITLE_ROW, column=index, value=title)


def _workbook(
    *,
    sale_date: date = date(2026, 1, 10),
    payment: str = "Pendiente",
    threshold: float | None = 5,
) -> Workbook:
    workbook = Workbook()
    active = workbook.active
    assert active is not None
    workbook.remove(active)

    ajustes = workbook.create_sheet(layout.AJUSTES_SHEET)
    ajustes.cell(row=7, column=1, value=VARIETY)
    if threshold is not None:
        ajustes.cell(row=7, column=6, value=threshold)
    ajustes.cell(row=21, column=1, value="Insumos")
    ajustes.cell(row=37, column=1, value=VARIETY)
    ajustes.cell(row=37, column=2, value=date(2026, 1, 1))
    ajustes.cell(row=37, column=3, value=1000)

    catalogo = workbook.create_sheet(layout.CATALOGO_SHEET)
    catalogo.cell(row=6, column=1, value=VARIETY)
    catalogo.cell(row=6, column=2, value="Sí")
    catalogo.cell(row=18, column=2, value="Catálogo de la casa")
    catalogo.cell(row=19, column=2, value="Gracias por su compra")

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    ventas.cell(row=2, column=1, value=sale_date)
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=10)
    ventas.cell(row=2, column=4, value=payment)
    ventas.cell(row=2, column=5, value=SALE_TOTAL)
    ventas.cell(row=2, column=6, value=CUSTOMER)
    ventas.cell(row=2, column=7, value="")

    entradas = workbook.create_sheet(layout.ENTRADAS_SHEET)
    _titles(entradas, ENTRADAS_TITLES)
    entradas.cell(row=2, column=1, value=date(2026, 1, 1))
    entradas.cell(row=2, column=2, value=VARIETY)
    entradas.cell(row=2, column=3, value=50)
    entradas.cell(row=2, column=4, value="Compra")
    entradas.cell(row=2, column=5, value=20_000)

    gastos = workbook.create_sheet(layout.GASTOS_SHEET)
    _titles(gastos, GASTOS_TITLES)
    gastos.cell(row=2, column=1, value=date(2026, 1, 2))
    gastos.cell(row=2, column=2, value="Insumos")
    gastos.cell(row=2, column=3, value=500)
    gastos.cell(row=2, column=4, value="Bolsas")

    return workbook


def _save_workbook(workbook: Workbook, tmp_path: Path, name: str = "sheet.xlsx") -> Path:
    path = tmp_path / name
    workbook.save(path)
    return path


def _save_mapping(
    tmp_path: Path, rows: tuple[tuple[str, str], ...], name: str = "mapping.csv"
) -> Path:
    path = tmp_path / name
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("name,phone\n")
        for row_name, phone in rows:
            handle.write(f"{row_name},{phone}\n")
    return path


def _business_id(engine: Engine, name: str = "Primer Negocio") -> int:
    with Session(engine) as session:
        row = session.scalars(select(BusinessRow).where(BusinessRow.name == name)).one()
        assert row.id is not None
        return row.id


def test_dry_run_writes_nothing_and_reports_the_counts(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping), "--dry-run"],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
    )

    assert code == 0
    assert err.getvalue() == ""
    assert "Sales: 1" in out.getvalue()
    assert "Writable: yes" in out.getvalue()
    assert client.get("/varieties").json() == []
    assert client.get("/customers").json() == []
    assert client.get("/stock").json()["varieties"] == []


def test_real_run_imports_and_the_figures_match(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
    )

    assert code == 0, err.getvalue()
    assert err.getvalue() == ""

    varieties = client.get("/varieties").json()
    assert len(varieties) == 1
    assert varieties[0]["name"] == VARIETY
    assert varieties[0]["current_price"]["list_price"] == 1000

    catalog = client.get("/catalog").json()
    assert catalog["header"] == "Catálogo de la casa"
    assert catalog["footer"] == "Gracias por su compra"

    stock = client.get("/stock").json()
    assert len(stock["varieties"]) == 1
    # 50 g bought in, 10 g sold: 40 g left.
    assert stock["varieties"][0]["grams"] == 40.0
    assert stock["varieties"][0]["threshold"] == 5.0

    customers = client.get("/customers").json()
    assert len(customers) == 1
    assert customers[0]["name"] == CUSTOMER
    assert customers[0]["balance"] == SALE_TOTAL
    assert customers[0]["owing_since"] == "2026-01-10"


def test_an_unknown_business_is_refused_with_no_echo(
    engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    upgrade_to_head(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(["999999", str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err)

    assert code == 1
    assert err.getvalue() == "refused: import.business_unknown\n"
    assert out.getvalue() == ""


def test_a_business_with_records_is_refused_with_nothing_written(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    client.post("/varieties", json={"name": "Existente"})
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 1
    assert err.getvalue() == ""
    assert "import.business_has_records" in out.getvalue()
    varieties = client.get("/varieties").json()
    assert [v["name"] for v in varieties] == ["Existente"]


def test_imported_records_are_invisible_from_another_business(
    client: TestClient,
    other_client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 0, err.getvalue()
    assert other_client.get("/varieties").json() == []
    assert other_client.get("/customers").json() == []
    assert other_client.get("/stock").json()["varieties"] == []


def test_a_malformed_mapping_is_reported_with_no_phone_or_name(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping_path = tmp_path / "mapping.csv"
    # A header that doesn't match at all: every entry is unreachable, so the
    # problem is located by line number alone, never by content.
    mapping_path.write_text(f"nombre,telefono\n{CUSTOMER},{PHONE}\n", encoding="utf-8")
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping_path), "--dry-run"],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
    )

    assert code == 0
    report = out.getvalue()
    assert PHONE not in report
    assert CUSTOMER not in report
    assert err.getvalue() == ""


def test_a_write_failure_is_refused_by_class_name_with_no_echo(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.spreadsheet_import.application.write_import as write_import_module

    def _boom(*_args: Any, **_kwargs: Any) -> dict[str, int]:
        raise RuntimeError(f"duplicate phone {PHONE}")

    monkeypatch.setattr(write_import_module, "_write_customers", _boom)

    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 1
    assert err.getvalue() == "refused: RuntimeError\n"
    assert PHONE not in out.getvalue()
    assert PHONE not in err.getvalue()
    assert client.get("/varieties").json() == []
    assert client.get("/customers").json() == []
