"""GH-63: the whole `Pago`, `Tipo`, `Origen` and Catálogo-shown vocabulary, through
`cli.run` and the real ports, read back over the HTTP API (CODING_STANDARDS.md section
5: never by building rows by hand). Before this fix, every finished Ventas row paid
"Efectivo" or "Transferencia" raised `ValueError` from `PaymentMethod(sale.method)` and
the dry run printed only `refused: ValueError`, no report at all.

Rows are built by iterating the import's own public mapping tables (the plan's
invariant: each accepted sheet word of a fixed-value cell appears in exactly one public
mapping table, and a vocabulary test iterates those tables instead of restating the
words) rather than a second, hand-written list of the same words.
"""

from __future__ import annotations

import io
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.catalog.adapters.import_port import SHOWN_WORDS
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from app.spreadsheet_import.domain.plan import PAGO_WORDS, TIPO_WORDS
from app.stock.adapters.import_port import ORIGEN_WORDS
from tests.conftest import MovableClock

VARIETY = "Jack Herer"
HIDDEN_VARIETY = "OG Kush"
AMIGO_CUSTOMER = "Juana Lista"
AMIGO_PHONE = "1123456789"

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


def _titles(ws: Worksheet, titles: tuple[str, ...]) -> None:
    for index, title in enumerate(titles, start=1):
        ws.cell(row=layout.TITLE_ROW, column=index, value=title)


def _business_id(engine: Engine, name: str = "Primer Negocio") -> int:
    with Session(engine) as session:
        row = session.scalars(select(BusinessRow).where(BusinessRow.name == name)).one()
        assert row.id is not None
        return row.id


def _save(path: Path, workbook: Workbook) -> Path:
    workbook.save(path)
    return path


def _save_mapping(path: Path, rows: tuple[tuple[str, str], ...]) -> Path:
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("name,phone\n")
        for name, phone in rows:
            handle.write(f"{name},{phone}\n")
    return path


def _vocabulary_workbook() -> Workbook:
    """One row per `Pago` word and per `Tipo` word (the brief's own pairing: the
    Amigo customer's second row is a `Lista` one, below the bulk minimum; the blank
    `Tipo` row pays `Transferencia`; the `Regalo` row's `Pago` is blank), one Entradas
    row per `Origen` word, and one Catálogo row per `Mostrado` word (`SHOWN_WORDS`)."""
    assert set(PAGO_WORDS) == {"Efectivo", "Transferencia", "Pendiente"}
    assert set(TIPO_WORDS) == {"", "Lista", "Amigo", "Regalo"}

    workbook = Workbook()
    active = workbook.active
    assert active is not None
    workbook.remove(active)

    ajustes = workbook.create_sheet(layout.AJUSTES_SHEET)
    ajustes.cell(row=7, column=1, value=VARIETY)
    ajustes.cell(row=8, column=1, value=HIDDEN_VARIETY)
    ajustes.cell(row=37, column=1, value=VARIETY)
    ajustes.cell(row=37, column=2, value=date(2026, 1, 1))
    ajustes.cell(row=37, column=3, value=1000)  # list price
    ajustes.cell(row=37, column=4, value=800)  # bulk price
    ajustes.cell(row=37, column=5, value=10)  # bulk minimum (g)

    catalogo = workbook.create_sheet(layout.CATALOGO_SHEET)
    shown_varieties = {True: VARIETY, False: HIDDEN_VARIETY}
    for index, (word, flag) in enumerate(SHOWN_WORDS.items()):
        row = layout.CATALOG_FIRST_ROW + index
        catalogo.cell(row=row, column=layout.CATALOG_VARIETY_COLUMN, value=shown_varieties[flag])
        catalogo.cell(row=row, column=layout.CATALOG_SHOWN_COLUMN, value=word)

    workbook.create_sheet(layout.GASTOS_SHEET)
    _titles(workbook[layout.GASTOS_SHEET], GASTOS_TITLES)

    entradas = workbook.create_sheet(layout.ENTRADAS_SHEET)
    _titles(entradas, ENTRADAS_TITLES)
    for index, origin_word in enumerate(ORIGEN_WORDS):
        row = layout.DATA_FIRST_ROW + index
        entradas.cell(row=row, column=1, value=date(2026, 1, 1))
        entradas.cell(row=row, column=2, value=VARIETY)
        entradas.cell(row=row, column=3, value=20)  # positive grams, every origin
        entradas.cell(row=row, column=4, value=origin_word)
        if origin_word == "Compra":
            entradas.cell(row=row, column=5, value=2000)

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    # Row 2: Amigo, left owing ("Pendiente"); vip pricing (800/g bulk rate) regardless
    # of the bulk minimum: 5g * 800 = 4000.
    ventas.cell(row=2, column=1, value=date(2026, 2, 1))
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=5)
    ventas.cell(row=2, column=4, value="Pendiente")
    ventas.cell(row=2, column=5, value=4000)
    ventas.cell(row=2, column=6, value=AMIGO_CUSTOMER)
    ventas.cell(row=2, column=7, value="Amigo")
    # Row 3: the Amigo customer's second row, "Lista", below the bulk minimum (1g <
    # 10g): list pricing, 1 * 1000 = 1000, paid "Efectivo".
    ventas.cell(row=3, column=1, value=date(2026, 2, 2))
    ventas.cell(row=3, column=2, value=VARIETY)
    ventas.cell(row=3, column=3, value=1)
    ventas.cell(row=3, column=4, value="Efectivo")
    ventas.cell(row=3, column=5, value=1000)
    ventas.cell(row=3, column=6, value=AMIGO_CUSTOMER)
    ventas.cell(row=3, column=7, value="Lista")
    # Row 4: blank Tipo, anonymous, paid "Transferencia". 2 * 1000 = 2000.
    ventas.cell(row=4, column=1, value=date(2026, 2, 3))
    ventas.cell(row=4, column=2, value=VARIETY)
    ventas.cell(row=4, column=3, value=2)
    ventas.cell(row=4, column=4, value="Transferencia")
    ventas.cell(row=4, column=5, value=2000)
    ventas.cell(row=4, column=7, value="")
    # Row 5: a gift, blank Pago, $0 total.
    ventas.cell(row=5, column=1, value=date(2026, 2, 4))
    ventas.cell(row=5, column=2, value=VARIETY)
    ventas.cell(row=5, column=3, value=1)
    ventas.cell(row=5, column=5, value=0)
    ventas.cell(row=5, column=7, value="Regalo")

    return workbook


def test_the_whole_vocabulary_dry_runs_clean_and_real_runs_as_import_md_says(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _vocabulary_workbook())
    mapping = _save_mapping(tmp_path / "mapping.csv", ((AMIGO_CUSTOMER, AMIGO_PHONE),))

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
    report = out.getvalue()
    assert "refused:" not in report
    assert "Blocking problems:" not in report
    assert "Writable: yes" in report

    out, err = io.StringIO(), io.StringIO()
    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )
    assert code == 0, err.getvalue()
    assert err.getvalue() == ""
    assert "refused:" not in out.getvalue()

    sales = {sale["date"]: sale for sale in client.get("/sales").json()}
    assert sales["2026-02-01"]["payment"] == "owing"
    assert sales["2026-02-01"]["lines"][0]["pricing_rule"] == "vip"
    assert sales["2026-02-02"]["payment"] == "cash"
    assert sales["2026-02-02"]["lines"][0]["pricing_rule"] == "list"
    assert sales["2026-02-03"]["payment"] == "transfer"
    assert sales["2026-02-04"]["payment"] == "none"

    customers = {c["name"]: c for c in client.get("/customers").json()}
    assert customers[AMIGO_CUSTOMER]["vip"] is True
    assert customers[AMIGO_CUSTOMER]["balance"] == 4000

    varieties_by_name = {v["name"]: v["id"] for v in client.get("/varieties").json()}
    stock_by_variety = {row["variety_id"]: row for row in client.get("/stock").json()["varieties"]}
    # 4 origins * 20g in, 9g sold (5 + 1 + 2 + 1): 71g left.
    assert stock_by_variety[varieties_by_name[VARIETY]]["grams"] == 71.0
    assert stock_by_variety[varieties_by_name[HIDDEN_VARIETY]]["grams"] == 0.0

    catalog = client.get("/catalog").json()
    shown_flags = {entry["name"]: entry["shown"] for entry in catalog["varieties"]}
    assert shown_flags[VARIETY] is True
    assert shown_flags[HIDDEN_VARIETY] is False


def _blocking_pago_workbook(pago_cell: str | None) -> Workbook:
    workbook = Workbook()
    active = workbook.active
    assert active is not None
    workbook.remove(active)

    ajustes = workbook.create_sheet(layout.AJUSTES_SHEET)
    ajustes.cell(row=7, column=1, value=VARIETY)
    ajustes.cell(row=37, column=1, value=VARIETY)
    ajustes.cell(row=37, column=2, value=date(2026, 1, 1))
    ajustes.cell(row=37, column=3, value=1000)

    workbook.create_sheet(layout.CATALOGO_SHEET)

    workbook.create_sheet(layout.ENTRADAS_SHEET)
    _titles(workbook[layout.ENTRADAS_SHEET], ENTRADAS_TITLES)

    workbook.create_sheet(layout.GASTOS_SHEET)
    _titles(workbook[layout.GASTOS_SHEET], GASTOS_TITLES)

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    ventas.cell(row=2, column=1, value=date(2026, 1, 10))
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=1)
    if pago_cell is not None:
        ventas.cell(row=2, column=4, value=pago_cell)
    ventas.cell(row=2, column=5, value=1000)
    ventas.cell(row=2, column=7, value="")

    return workbook


def test_a_blank_pago_on_a_finished_row_above_zero_blocks_as_payment_required(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _blocking_pago_workbook(None))
    mapping = _save_mapping(tmp_path / "mapping.csv", ())

    for argv_tail in (["--dry-run"], []):
        out, err = io.StringIO(), io.StringIO()
        code = run(
            [str(business_id), str(xlsx), str(mapping), *argv_tail],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )
        assert code in (0, 1)
        assert err.getvalue() == ""
        report = out.getvalue()
        assert "refused:" not in report
        assert "Writable: no" in report
        assert "Ventas row 2 [Ventas]: sale.payment_required" in report
        assert client.get("/sales").json() == []


def test_an_unknown_pago_word_on_a_finished_row_above_zero_blocks_as_payment_unknown(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _blocking_pago_workbook("Cheque"))
    mapping = _save_mapping(tmp_path / "mapping.csv", ())

    for argv_tail in (["--dry-run"], []):
        out, err = io.StringIO(), io.StringIO()
        code = run(
            [str(business_id), str(xlsx), str(mapping), *argv_tail],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )
        assert code in (0, 1)
        assert err.getvalue() == ""
        report = out.getvalue()
        assert "refused:" not in report
        assert "Writable: no" in report
        assert "Ventas row 2 [Pago]: import.payment_unknown" in report
        assert client.get("/sales").json() == []
