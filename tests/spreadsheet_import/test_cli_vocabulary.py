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
from app.shared.copy import OperatorText
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
    """One Ventas row per `TIPO_WORDS` entry, `Pago` taken from `PAGO_WORDS` at the
    same index (never restated as a second, hand-written word): `PAGO_WORDS` has one
    fewer entry than `TIPO_WORDS`, so the last row is the one left with no `Pago` word
    at all, exactly the shape a gift row needs under import.md. Rows 1 and 2 (0-based)
    share one customer, row 1 below the bulk minimum, so the same fixture proves both
    the `list` and the `vip` pricing rule — every shaping decision below is keyed by
    that row's position alone, never by comparing a cell's own word. One Entradas row
    per `ORIGEN_WORDS` entry, one Catálogo row per `SHOWN_WORDS` entry."""
    pago_words = list(PAGO_WORDS)
    tipo_words = list(TIPO_WORDS)
    assert len(pago_words) == len(tipo_words) - 1, "one Tipo row is left with no Pago word"

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

    # Row shape, by position alone (never by a word the row itself holds):
    #   0: anonymous, list pricing, grams above the bulk minimum.
    #   1: the shared customer's first row, below the bulk minimum (list pricing).
    #   2: the shared customer's second row, left owing (vip pricing regardless of
    #      the bulk minimum).
    #   3: the one row with no Pago word at all (`PAGO_WORDS` runs one entry short):
    #      a $0 total, so the owner's own $0 rule leaves it with no method either way.
    _QUANTITY = (2, 1, 5, 1)
    _TOTAL = (2000, 1000, 4000, 0)
    _NEEDS_CUSTOMER = (False, True, True, False)

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    for index, kind_word in enumerate(tipo_words):
        row = layout.DATA_FIRST_ROW + index
        pago_word = pago_words[index] if index < len(pago_words) else None

        ventas.cell(row=row, column=1, value=date(2026, 2, 1 + index))
        ventas.cell(row=row, column=2, value=VARIETY)
        ventas.cell(row=row, column=3, value=_QUANTITY[index])
        if pago_word is not None:
            ventas.cell(row=row, column=4, value=pago_word)
        ventas.cell(row=row, column=5, value=_TOTAL[index])
        if _NEEDS_CUSTOMER[index]:
            ventas.cell(row=row, column=6, value=AMIGO_CUSTOMER)
        ventas.cell(row=row, column=7, value=kind_word)

    return workbook


def test_the_whole_vocabulary_dry_runs_clean_and_real_runs_as_import_md_says(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _vocabulary_workbook())
    mapping = _save_mapping(tmp_path / "mapping.csv", ((AMIGO_CUSTOMER, AMIGO_PHONE),))

    out, err = io.StringIO(), io.StringIO()
    code = run(
        [str(business_id), str(xlsx), "--mapping", str(mapping), "--dry-run"],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
        text=operator_text_en,
    )
    assert code == 0
    assert err.getvalue() == ""
    report = out.getvalue()
    assert "refused:" not in report
    assert "Blocking problems:" not in report
    assert "Writable: yes" in report

    out, err = io.StringIO(), io.StringIO()
    code = run(
        [str(business_id), str(xlsx), "--mapping", str(mapping)],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
        text=operator_text_en,
    )
    assert code == 0, err.getvalue()
    assert err.getvalue() == ""
    assert "refused:" not in out.getvalue()

    # Row 0 (date 02-01): anonymous, the first Pago word, list pricing.
    # Row 1 (date 02-02): the shared customer, the second Pago word, below the bulk
    # minimum (list pricing).
    # Row 2 (date 02-03): the shared customer, the third (last) Pago word, left owing
    # (vip pricing, regardless of the bulk minimum).
    # Row 3 (date 02-04): no Pago word at all, a $0 total: no method either way.
    sales = {sale["date"]: sale for sale in client.get("/sales").json()}
    assert sales["2026-02-01"]["lines"][0]["pricing_rule"] == "list"
    assert sales["2026-02-02"]["lines"][0]["pricing_rule"] == "list"
    assert sales["2026-02-03"]["payment"] == "owing"
    assert sales["2026-02-03"]["lines"][0]["pricing_rule"] == "vip"
    assert sales["2026-02-04"]["payment"] == "none"
    paid_methods = {sales["2026-02-01"]["payment"], sales["2026-02-02"]["payment"]}
    assert paid_methods == {"cash", "transfer"}

    customers = {c["name"]: c for c in client.get("/customers").json()}
    assert customers[AMIGO_CUSTOMER]["vip"] is True
    assert customers[AMIGO_CUSTOMER]["balance"] == 4000

    varieties_by_name = {v["name"]: v["id"] for v in client.get("/varieties").json()}
    stock = client.get("/stock").json()
    stock_by_variety = {row["variety_id"]: row for row in stock["varieties"]}
    # 4 origins * 20g in, 9g sold (5 + 1 + 2 + 1): 71g left.
    assert stock_by_variety[varieties_by_name[VARIETY]]["quantity"] == 71.0
    assert stock_by_variety[varieties_by_name[HIDDEN_VARIETY]]["quantity"] == 0.0
    stored_origins = {entry["origin"] for entry in stock["entries"]}
    assert stored_origins == {origin.value for origin in ORIGEN_WORDS.values()}

    catalog = client.get("/catalog").json()
    shown_flags = {entry["name"]: entry["shown"] for entry in catalog["varieties"]}
    assert shown_flags[VARIETY] is True
    assert shown_flags[HIDDEN_VARIETY] is False


# PM's own words (the adjustment's "For the next role"): a canary that catches a word
# silently dropped from a table even though `_vocabulary_workbook` above, by design,
# never restates one. This is the only place in this module allowed to type them by
# hand.
LISTA_CUSTOMER = "Vera Lista"
LISTA_PHONE = "1123450001"
AMIGA_CUSTOMER = "Mora Amiga"
AMIGA_PHONE = "1123450002"
DEUDOR_CUSTOMER = "Tito Deudor"
DEUDOR_PHONE = "1123450003"


def _literal_word_workbook() -> Workbook:
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

    entradas = workbook.create_sheet(layout.ENTRADAS_SHEET)
    _titles(entradas, ENTRADAS_TITLES)
    entradas.cell(row=2, column=1, value=date(2026, 1, 1))
    entradas.cell(row=2, column=2, value=VARIETY)
    entradas.cell(row=2, column=3, value=20)
    entradas.cell(row=2, column=4, value="Compra")
    entradas.cell(row=2, column=5, value=2000)
    entradas.cell(row=3, column=1, value=date(2026, 1, 1))
    entradas.cell(row=3, column=2, value=VARIETY)
    entradas.cell(row=3, column=3, value=20)
    entradas.cell(row=3, column=4, value="Stock inicial")

    workbook.create_sheet(layout.GASTOS_SHEET)
    _titles(workbook[layout.GASTOS_SHEET], GASTOS_TITLES)

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    ventas.cell(row=2, column=1, value=date(2026, 3, 1))
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=1)
    ventas.cell(row=2, column=4, value="Efectivo")
    ventas.cell(row=2, column=5, value=1000)
    ventas.cell(row=2, column=6, value=LISTA_CUSTOMER)
    ventas.cell(row=2, column=7, value="Lista")
    ventas.cell(row=3, column=1, value=date(2026, 3, 2))
    ventas.cell(row=3, column=2, value=VARIETY)
    ventas.cell(row=3, column=3, value=1)
    ventas.cell(row=3, column=4, value="Transferencia")
    ventas.cell(row=3, column=5, value=1000)
    ventas.cell(row=3, column=6, value=AMIGA_CUSTOMER)
    ventas.cell(row=3, column=7, value="Amigo")
    ventas.cell(row=4, column=1, value=date(2026, 3, 3))
    ventas.cell(row=4, column=2, value=VARIETY)
    ventas.cell(row=4, column=3, value=1)
    ventas.cell(row=4, column=4, value="Pendiente")
    ventas.cell(row=4, column=5, value=1000)
    ventas.cell(row=4, column=6, value=DEUDOR_CUSTOMER)
    ventas.cell(row=4, column=7, value="")

    return workbook


def test_pm_s_own_words_dry_run_clean_real_run_stores_cash_transfer_and_one_owing(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _literal_word_workbook())
    mapping = _save_mapping(
        tmp_path / "mapping.csv",
        (
            (LISTA_CUSTOMER, LISTA_PHONE),
            (AMIGA_CUSTOMER, AMIGA_PHONE),
            (DEUDOR_CUSTOMER, DEUDOR_PHONE),
        ),
    )

    out, err = io.StringIO(), io.StringIO()
    code = run(
        [str(business_id), str(xlsx), "--mapping", str(mapping), "--dry-run"],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
        text=operator_text_en,
    )
    assert code == 0
    assert err.getvalue() == ""
    assert "Blocking problems:" not in out.getvalue()
    assert "Writable: yes" in out.getvalue()

    out, err = io.StringIO(), io.StringIO()
    code = run(
        [str(business_id), str(xlsx), "--mapping", str(mapping)],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
        text=operator_text_en,
    )
    assert code == 0, err.getvalue()
    assert err.getvalue() == ""
    assert "refused:" not in out.getvalue()

    sales = client.get("/sales").json()
    assert len(sales) == 3
    methods = {sale["payment"] for sale in sales}
    assert methods == {"cash", "transfer", "owing"}
    assert sum(1 for sale in sales if sale["payment"] == "owing") == 1


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
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _blocking_pago_workbook(None))
    mapping = _save_mapping(tmp_path / "mapping.csv", ())

    for argv_tail in (["--dry-run"], []):
        out, err = io.StringIO(), io.StringIO()
        code = run(
            [str(business_id), str(xlsx), "--mapping", str(mapping), *argv_tail],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
            text=operator_text_en,
        )
        assert code in (0, 1)
        assert err.getvalue() == ""
        report = out.getvalue()
        assert "refused:" not in report
        assert "Writable: no" in report
        assert "Ventas row 2 [Ventas]: sale.payment_required" in report
        assert client.get("/sales").json() == []


def test_an_unknown_pago_word_on_a_finished_row_above_zero_blocks_as_payment_unknown(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save(tmp_path / "sheet.xlsx", _blocking_pago_workbook("Cheque"))
    mapping = _save_mapping(tmp_path / "mapping.csv", ())

    for argv_tail in (["--dry-run"], []):
        out, err = io.StringIO(), io.StringIO()
        code = run(
            [str(business_id), str(xlsx), "--mapping", str(mapping), *argv_tail],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
            text=operator_text_en,
        )
        assert code in (0, 1)
        assert err.getvalue() == ""
        report = out.getvalue()
        assert "refused:" not in report
        assert "Writable: no" in report
        assert "Ventas row 2 [Pago]: import.payment_unknown" in report
        assert client.get("/sales").json() == []
