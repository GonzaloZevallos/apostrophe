"""Turns a workbook into `ParsedWorkbook` (the plan's invariant: every cell value
becomes `Grams`, a peso int, a date or text only here; no float reaches `Grams.of` or
an `int()` cast without a whole-number check first).

A row whose typed columns are all blank is skipped before any formula cell of it is
read, and never appears in the report. `layout.py` alone names the sheets, the fixed
cells and the header titles this module reads; nothing here hard-codes one.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

if TYPE_CHECKING:
    from openpyxl.cell import _CellGetValue

from app.shared.grams import Grams, InvalidGrams
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.domain.rows import (
    CatalogRow,
    CategoryRow,
    CellProblem,
    EntradaRow,
    GastoRow,
    HeaderFooterCells,
    ParsedWorkbook,
    PriceHistoryRow,
    SheetRef,
    VarietyRow,
    VentaRow,
)

# `SheetRef` needs a row; `not_recalculated` is workbook-wide, not one row's problem.
_NO_ROW = 0


class _CellError(Exception):
    """A single cell broke a reading rule. Carries only a fixed `kind` slug (the
    plan's invariant: never the value that broke it), caught where the row is built
    so the rest of that row still gets read."""

    def __init__(self, kind: str) -> None:
        super().__init__(kind)
        self.kind = kind


def _is_blank(value: _CellGetValue) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _to_text(value: _CellGetValue) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    raise _CellError("text_invalid")


def _require_text(value: _CellGetValue) -> str:
    text = _to_text(value)
    if text is None:
        raise _CellError("text_missing")
    return text


def _to_grams(value: _CellGetValue) -> Grams | None:
    if _is_blank(value):
        return None
    if isinstance(value, bool):
        raise _CellError("grams_not_numeric")
    if isinstance(value, int):
        return Grams.of(value)
    if isinstance(value, float):
        try:
            return Grams.of(Decimal(repr(value)))
        except InvalidGrams as exc:
            raise _CellError("grams_too_precise") from exc
    raise _CellError("grams_not_numeric")


def _to_pesos(value: _CellGetValue) -> int | None:
    if _is_blank(value):
        return None
    if isinstance(value, bool):
        raise _CellError("pesos_not_integer")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value.is_integer():
            return int(value)
        raise _CellError("pesos_not_integer")
    raise _CellError("pesos_not_integer")


def _require_pesos(value: _CellGetValue) -> int:
    pesos = _to_pesos(value)
    if pesos is None:
        raise _CellError("pesos_missing")
    return pesos


def _to_date(value: _CellGetValue) -> date | None:
    if _is_blank(value):
        return None
    if isinstance(value, datetime):
        if (value.hour, value.minute, value.second, value.microsecond) != (0, 0, 0, 0):
            raise _CellError("date_invalid")
        return value.date()
    if isinstance(value, date):
        return value
    raise _CellError("date_invalid")


def _require_date(value: _CellGetValue) -> date:
    result = _to_date(value)
    if result is None:
        raise _CellError("date_missing")
    return result


def _to_indica(value: _CellGetValue) -> int | str | None:
    """`% índica` is neither Grams, pesos, a date nor text, so it is read as the
    plain value it is: a true `int` cell stays an `int`; anything else present
    becomes its own text, left for the owner's check to refuse (CatalogRow's own
    type, fixed by `contract`)."""
    if _is_blank(value):
        return None
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return value
    return str(value)


def _field[T, U](
    problems: list[CellProblem],
    ref: SheetRef,
    column: str,
    convert: Callable[[U], T],
    value: U,
) -> T | None:
    try:
        return convert(value)
    except _CellError as exc:
        problems.append(CellProblem(ref, column, exc.kind))
        return None


def _locate_columns(
    ws: Worksheet, sheet: str, titles: tuple[str, ...]
) -> tuple[dict[str, int], list[CellProblem]]:
    max_column = ws.max_column or 0
    present: list[str] = []
    for column in range(1, max_column + 1):
        value = ws.cell(row=layout.TITLE_ROW, column=column).value
        text = _to_text(value) if isinstance(value, str) or value is None else str(value)
        present.append(text or "")
    counts = Counter(t for t in present if t)
    index_of: dict[str, int] = {}
    problems: list[CellProblem] = []
    ref = SheetRef(sheet, layout.TITLE_ROW)
    for title in titles:
        if counts.get(title, 0) == 0:
            problems.append(CellProblem(ref, title, "column_missing"))
        elif counts[title] > 1:
            problems.append(CellProblem(ref, title, "column_duplicate"))
        else:
            index_of[title] = present.index(title) + 1
    return index_of, problems


def _read_varieties(ws: Worksheet, problems: list[CellProblem]) -> tuple[VarietyRow, ...]:
    rows: list[VarietyRow] = []
    for row_number in range(layout.VARIETY_FIRST_ROW, layout.VARIETY_LAST_ROW + 1):
        raw_name = ws.cell(row=row_number, column=layout.VARIETY_NAME_COLUMN).value
        raw_threshold = ws.cell(row=row_number, column=layout.VARIETY_THRESHOLD_COLUMN).value
        if _is_blank(raw_name) and _is_blank(raw_threshold):
            continue
        ref = SheetRef(layout.AJUSTES_SHEET, row_number)
        row_problems: list[CellProblem] = []
        name = _field(row_problems, ref, "Variedad", _require_text, raw_name)
        threshold = _field(row_problems, ref, "F", _to_grams, raw_threshold)
        problems.extend(row_problems)
        if name is None:
            continue
        rows.append(VarietyRow(ref, name, threshold))
    return tuple(rows)


def _read_categories(ws: Worksheet, problems: list[CellProblem]) -> tuple[CategoryRow, ...]:
    rows: list[CategoryRow] = []
    for row_number in range(layout.CATEGORY_FIRST_ROW, layout.CATEGORY_LAST_ROW + 1):
        raw_name = ws.cell(row=row_number, column=layout.CATEGORY_NAME_COLUMN).value
        if _is_blank(raw_name):
            continue
        ref = SheetRef(layout.AJUSTES_SHEET, row_number)
        row_problems: list[CellProblem] = []
        name = _field(row_problems, ref, "Categoría", _require_text, raw_name)
        problems.extend(row_problems)
        if name is None:
            continue
        rows.append(CategoryRow(ref, name))
    return tuple(rows)


def _read_price_history(ws: Worksheet, problems: list[CellProblem]) -> tuple[PriceHistoryRow, ...]:
    rows: list[PriceHistoryRow] = []
    max_row = ws.max_row or 0
    for row_number in range(layout.PRICE_HISTORY_FIRST_ROW, max_row + 1):
        raw_variety = ws.cell(row=row_number, column=layout.PRICE_HISTORY_VARIETY_COLUMN).value
        raw_effective = ws.cell(row=row_number, column=layout.PRICE_HISTORY_EFFECTIVE_COLUMN).value
        raw_list_price = ws.cell(
            row=row_number, column=layout.PRICE_HISTORY_LIST_PRICE_COLUMN
        ).value
        raw_bulk_price = ws.cell(
            row=row_number, column=layout.PRICE_HISTORY_BULK_PRICE_COLUMN
        ).value
        raw_bulk_minimum = ws.cell(
            row=row_number, column=layout.PRICE_HISTORY_BULK_MINIMUM_COLUMN
        ).value
        if all(
            _is_blank(v)
            for v in (raw_variety, raw_effective, raw_list_price, raw_bulk_price, raw_bulk_minimum)
        ):
            continue
        ref = SheetRef(layout.AJUSTES_SHEET, row_number)
        row_problems: list[CellProblem] = []
        variety = _field(row_problems, ref, "Variedad", _require_text, raw_variety)
        effective = _field(row_problems, ref, "Rige desde", _require_date, raw_effective)
        list_price = _field(row_problems, ref, "Precio lista", _require_pesos, raw_list_price)
        bulk_price = _field(row_problems, ref, "Precio por cantidad", _to_pesos, raw_bulk_price)
        bulk_minimum = _field(row_problems, ref, "Cantidad mínima", _to_grams, raw_bulk_minimum)
        problems.extend(row_problems)
        if variety is None or effective is None or list_price is None:
            continue
        rows.append(PriceHistoryRow(ref, variety, effective, list_price, bulk_price, bulk_minimum))
    return tuple(rows)


def _read_catalog(ws: Worksheet, problems: list[CellProblem]) -> tuple[CatalogRow, ...]:
    rows: list[CatalogRow] = []
    for row_number in range(layout.CATALOG_FIRST_ROW, layout.CATALOG_LAST_ROW + 1):
        raw_variety = ws.cell(row=row_number, column=layout.CATALOG_VARIETY_COLUMN).value
        raw_shown = ws.cell(row=row_number, column=layout.CATALOG_SHOWN_COLUMN).value
        raw_emoji = ws.cell(row=row_number, column=layout.CATALOG_EMOJI_COLUMN).value
        raw_indica = ws.cell(row=row_number, column=layout.CATALOG_INDICA_COLUMN).value
        raw_aroma = ws.cell(row=row_number, column=layout.CATALOG_AROMA_COLUMN).value
        if all(_is_blank(v) for v in (raw_variety, raw_shown, raw_emoji, raw_indica, raw_aroma)):
            continue
        ref = SheetRef(layout.CATALOGO_SHEET, row_number)
        row_problems: list[CellProblem] = []
        variety = _field(row_problems, ref, "Variedad", _require_text, raw_variety)
        shown = _field(row_problems, ref, "Mostrado", _require_text, raw_shown)
        emoji = _field(row_problems, ref, "Emoji", _to_text, raw_emoji)
        indica = _field(row_problems, ref, "% índica", _to_indica, raw_indica)
        aroma = _field(row_problems, ref, "Aroma", _to_text, raw_aroma)
        problems.extend(row_problems)
        if variety is None or shown is None:
            continue
        rows.append(CatalogRow(ref, variety, shown, emoji, indica, aroma))
    return tuple(rows)


def _read_header_footer(ws: Worksheet, problems: list[CellProblem]) -> HeaderFooterCells:
    header_ref = SheetRef(layout.CATALOGO_SHEET, layout.HEADER_ROW)
    footer_ref = SheetRef(layout.CATALOGO_SHEET, layout.FOOTER_ROW)
    header_value = ws.cell(row=layout.HEADER_ROW, column=layout.HEADER_FOOTER_COLUMN).value
    footer_value = ws.cell(row=layout.FOOTER_ROW, column=layout.HEADER_FOOTER_COLUMN).value
    header = _field(problems, header_ref, "B18", _to_text, header_value) or ""
    footer = _field(problems, footer_ref, "B19", _to_text, footer_value) or ""
    return HeaderFooterCells(header, footer)


def _read_ventas(ws: Worksheet, problems: list[CellProblem]) -> tuple[VentaRow, ...]:
    all_titles = (*layout.VENTAS_TYPED_TITLES, layout.VENTAS_TOTAL_TITLE)
    columns, header_problems = _locate_columns(ws, layout.VENTAS_SHEET, all_titles)
    problems.extend(header_problems)
    if header_problems:
        return ()
    rows: list[VentaRow] = []
    not_recalculated = False
    max_row = ws.max_row or 0
    for row_number in range(layout.DATA_FIRST_ROW, max_row + 1):
        typed_raw = {
            title: ws.cell(row=row_number, column=columns[title]).value
            for title in layout.VENTAS_TYPED_TITLES
        }
        if all(_is_blank(v) for v in typed_raw.values()):
            continue
        ref = SheetRef(layout.VENTAS_SHEET, row_number)
        sale_date = _field(problems, ref, "Fecha", _to_date, typed_raw["Fecha"])
        variety = _field(problems, ref, "Variedad", _to_text, typed_raw["Variedad"])
        grams = _field(problems, ref, "Gramos", _to_grams, typed_raw["Gramos"])
        payment = _field(problems, ref, "Pago", _to_text, typed_raw["Pago"])
        customer = _field(problems, ref, "Cliente", _to_text, typed_raw["Cliente"])
        kind = _field(problems, ref, "Tipo", _to_text, typed_raw["Tipo"])
        shipping = _field(problems, ref, "Envío cobrado", _to_pesos, typed_raw["Envío cobrado"])
        special_total = _field(
            problems,
            ref,
            "Precio especial (total)",
            _to_pesos,
            typed_raw["Precio especial (total)"],
        )
        note = _field(problems, ref, "Nota", _to_text, typed_raw["Nota"])
        total_value = ws.cell(row=row_number, column=columns[layout.VENTAS_TOTAL_TITLE]).value
        total = _read_total(total_value)
        if total is None:
            not_recalculated = True
        rows.append(
            VentaRow(
                ref,
                sale_date,
                variety,
                grams,
                payment,
                customer,
                kind,
                shipping,
                special_total,
                note,
                total,
            )
        )
    if not_recalculated:
        problems.append(
            CellProblem(
                SheetRef(layout.VENTAS_SHEET, _NO_ROW),
                layout.VENTAS_TOTAL_TITLE,
                "not_recalculated",
            )
        )
    return tuple(rows)


def _read_total(value: _CellGetValue) -> int | str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else str(value)
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return str(value)


def _read_entradas(ws: Worksheet, problems: list[CellProblem]) -> tuple[EntradaRow, ...]:
    all_titles = (*layout.ENTRADAS_TYPED_TITLES, layout.ENTRADAS_REVISAR_TITLE)
    columns, header_problems = _locate_columns(ws, layout.ENTRADAS_SHEET, all_titles)
    problems.extend(header_problems)
    if header_problems:
        return ()
    rows: list[EntradaRow] = []
    max_row = ws.max_row or 0
    for row_number in range(layout.DATA_FIRST_ROW, max_row + 1):
        typed_raw = {
            title: ws.cell(row=row_number, column=columns[title]).value
            for title in layout.ENTRADAS_TYPED_TITLES
        }
        if all(_is_blank(v) for v in typed_raw.values()):
            continue
        ref = SheetRef(layout.ENTRADAS_SHEET, row_number)
        entry_date = _field(problems, ref, "Fecha", _to_date, typed_raw["Fecha"])
        variety = _field(problems, ref, "Variedad", _to_text, typed_raw["Variedad"])
        grams = _field(problems, ref, "Gramos", _to_grams, typed_raw["Gramos"])
        origin = _field(problems, ref, "Origen", _to_text, typed_raw["Origen"])
        total_cost = _field(problems, ref, "Costo total", _to_pesos, typed_raw["Costo total"])
        note = _field(problems, ref, "Nota", _to_text, typed_raw["Nota"])
        revisar_value = ws.cell(row=row_number, column=columns[layout.ENTRADAS_REVISAR_TITLE]).value
        revisar = _field(problems, ref, "Revisar", _to_text, revisar_value)
        rows.append(EntradaRow(ref, entry_date, variety, grams, origin, total_cost, note, revisar))
    return tuple(rows)


def _read_gastos(ws: Worksheet, problems: list[CellProblem]) -> tuple[GastoRow, ...]:
    all_titles = (*layout.GASTOS_TYPED_TITLES, layout.GASTOS_REVISAR_TITLE)
    columns, header_problems = _locate_columns(ws, layout.GASTOS_SHEET, all_titles)
    problems.extend(header_problems)
    if header_problems:
        return ()
    rows: list[GastoRow] = []
    max_row = ws.max_row or 0
    for row_number in range(layout.DATA_FIRST_ROW, max_row + 1):
        typed_raw = {
            title: ws.cell(row=row_number, column=columns[title]).value
            for title in layout.GASTOS_TYPED_TITLES
        }
        if all(_is_blank(v) for v in typed_raw.values()):
            continue
        ref = SheetRef(layout.GASTOS_SHEET, row_number)
        spent_on = _field(problems, ref, "Fecha", _to_date, typed_raw["Fecha"])
        category = _field(problems, ref, "Categoría", _to_text, typed_raw["Categoría"])
        amount = _field(problems, ref, "Monto", _to_pesos, typed_raw["Monto"])
        detail = _field(problems, ref, "Detalle", _to_text, typed_raw["Detalle"])
        revisar_value = ws.cell(row=row_number, column=columns[layout.GASTOS_REVISAR_TITLE]).value
        revisar = _field(problems, ref, "Revisar", _to_text, revisar_value)
        rows.append(GastoRow(ref, spent_on, category, amount, detail, revisar))
    return tuple(rows)


def read_workbook(path: Path) -> ParsedWorkbook:
    """Opens `path` with `read_only=True, data_only=True` (§8: no formula is
    evaluated, no link followed) and reads every sheet `layout.py` names."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        problems: list[CellProblem] = []
        ajustes = workbook[layout.AJUSTES_SHEET]
        catalogo = workbook[layout.CATALOGO_SHEET]
        ventas = workbook[layout.VENTAS_SHEET]
        entradas = workbook[layout.ENTRADAS_SHEET]
        gastos = workbook[layout.GASTOS_SHEET]

        varieties = _read_varieties(ajustes, problems)
        categories = _read_categories(ajustes, problems)
        price_history = _read_price_history(ajustes, problems)
        catalog = _read_catalog(catalogo, problems)
        header_footer = _read_header_footer(catalogo, problems)
        ventas_rows = _read_ventas(ventas, problems)
        entradas_rows = _read_entradas(entradas, problems)
        gastos_rows = _read_gastos(gastos, problems)

        return ParsedWorkbook(
            varieties=varieties,
            price_history=price_history,
            catalog=catalog,
            header_footer=header_footer,
            categories=categories,
            entradas=entradas_rows,
            gastos=gastos_rows,
            ventas=ventas_rows,
            problems=tuple(problems),
        )
    finally:
        workbook.close()
