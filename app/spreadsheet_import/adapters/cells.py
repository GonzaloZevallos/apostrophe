"""Turns a workbook into `ParsedWorkbook` (the plan's invariant: every cell value
becomes `Grams`, a peso int, a date or text only here; no float reaches `Grams.of` or
an `int()` cast without a whole-number check first).

A row whose typed columns are all blank is skipped before any formula cell of it is
read, and never appears in the report. `layout.py` alone names the sheets, the fixed
cells and the header titles this module reads; nothing here hard-codes one.

A Google Sheets export carries no stored `<dimension>` (GH-55), so a sheet's extent
never comes from `ws.max_row`/`ws.max_column`/`ws.dimensions`/`calculate_dimension`:
each worksheet is read once into a grid, through `_grid`, after `reset_dimensions()`
forces openpyxl to stop trusting a possibly-wrong or absent one; `_at` is the only
code that reads a cell's value out of that grid, and `_last_row` the only source of a
sheet's extent (the plan's invariants).
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Generator
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Literal, Protocol

from openpyxl import load_workbook

if TYPE_CHECKING:
    from openpyxl.cell import _CellGetValue

from app.shared.quantity import Quantity, InvalidQuantity
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

type _Grid = list[tuple[_CellGetValue, ...]]


class _SizableWorksheet(Protocol):
    """What `_grid` needs from a worksheet opened `read_only=True`: `reset_dimensions`
    and `iter_rows` are both declared on openpyxl's own `ReadOnlyWorksheet`, but a
    worksheet fetched from a `Workbook` is typed more broadly, so this is named
    structurally rather than by that one concrete class."""

    def reset_dimensions(self) -> None: ...
    def iter_rows(
        self, *, values_only: Literal[True]
    ) -> Generator[tuple[_CellGetValue, ...]]: ...


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
    if isinstance(value, bool):
        raise _CellError("text_invalid")
    if isinstance(value, (date, datetime, time)):
        # import.md: a date, datetime or time where text is expected can't be read
        # back as what was typed (Sheets may have swapped day/month or added a
        # year), so it blocks instead of guessing, with its own kind.
        raise _CellError("text_is_date")
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    raise _CellError("text_invalid")


def _require_text(value: _CellGetValue) -> str:
    text = _to_text(value)
    if text is None:
        raise _CellError("text_missing")
    return text


def _whole_or_none(value: int | float) -> int | None:
    """The plan's invariant: a float becomes an `int` only here, by way of
    `Decimal(repr(value))`, never through `int(float)`, `round` or float arithmetic.
    A `bool` (every caller checks first, but never through here) is never a number."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    amount = Decimal(repr(value))
    if amount == amount.to_integral_value():
        return int(amount)
    return None


def _number_text(value: int | float) -> str:
    """The plan's invariant: number text never carries an exponent or a `.0`, and
    uses a decimal comma. A whole value reads as its digits; anything else as the
    fewest decimals giving its exact value, with a comma in place of the point."""
    whole = _whole_or_none(value)
    if whole is not None:
        return str(whole)
    amount = Decimal(repr(value))
    return format(amount, "f").replace(".", ",")


def _to_quantity(value: _CellGetValue) -> Quantity | None:
    if _is_blank(value):
        return None
    if isinstance(value, bool):
        raise _CellError("grams_not_numeric")
    if isinstance(value, int):
        return Quantity.of(value)
    if isinstance(value, float):
        try:
            return Quantity.of(Decimal(repr(value)))
        except InvalidQuantity as exc:
            raise _CellError("grams_too_precise") from exc
    raise _CellError("grams_not_numeric")


def _to_pesos(value: _CellGetValue) -> int | None:
    if _is_blank(value):
        return None
    if isinstance(value, bool):
        raise _CellError("pesos_not_integer")
    if isinstance(value, (int, float)):
        whole = _whole_or_none(value)
        if whole is not None:
            return whole
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
    plain value it is: a true `int` or a whole float stays the whole number;
    anything else present becomes its own text, left for the owner's check to
    refuse (CatalogRow's own type, fixed by `contract`). A `bool`, like in every
    other reader, never becomes a number or text: it raises instead, so it is a
    reader cell-problem, never `catalog.indica_share_invalid`."""
    if _is_blank(value):
        return None
    if isinstance(value, bool):
        raise _CellError("indica_not_numeric")
    if isinstance(value, (int, float)):
        whole = _whole_or_none(value)
        if whole is not None:
            return whole
    return str(value)


def _to_text_or_number(value: _CellGetValue) -> str | None:
    """Used only for the text columns import.md lists: variety, customer and
    category names, `Detalle`, `Nota`, `Aroma`, the header and footer, `Origen`,
    `Pago`, `Tipo` and Catálogo's shown column. A number reads back as the text a
    seller would have typed (`_number_text`, never an exponent or a `.0`); a `bool`
    is checked first and always raises (never text); anything else — a
    date/datetime/time included — follows `_to_text`'s own rules."""
    if isinstance(value, bool):
        raise _CellError("text_invalid")
    if isinstance(value, (int, float)):
        return _number_text(value)
    return _to_text(value)


def _require_text_or_number(value: _CellGetValue) -> str:
    text = _to_text_or_number(value)
    if text is None:
        raise _CellError("text_missing")
    return text


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


def _grid(ws: _SizableWorksheet) -> _Grid:
    """One `iter_rows(values_only=True)` pass over `ws`, after `reset_dimensions()`:
    a Google Sheets export carries no stored dimension, and a stale one from any
    other source would cut the grid short either way, so every read starts by
    forcing openpyxl to stop trusting it. An empty sheet gives an empty grid and
    never fails."""
    ws.reset_dimensions()
    return list(ws.iter_rows(values_only=True))


def _at(grid: _Grid, row: int, column: int) -> _CellGetValue:
    """The only code that indexes `grid` for a cell's value. `row` and `column` are
    `layout.py`'s 1-based numbers; a row or column of 0 or less, a row past the
    last, or a column past a short row's end all answer `None`."""
    if row < 1 or column < 1 or row > len(grid):
        return None
    row_values = grid[row - 1]
    if column > len(row_values):
        return None
    return row_values[column - 1]


def _last_row(grid: _Grid) -> int:
    """The only source of a sheet's extent: the 1-based number of the last row that
    holds a cell, 0 when the sheet is empty."""
    for row_number in range(len(grid), 0, -1):
        if any(value is not None for value in grid[row_number - 1]):
            return row_number
    return 0


def _locate_columns(
    grid: _Grid, sheet: str, titles: tuple[str, ...]
) -> tuple[dict[str, int], list[CellProblem]]:
    # `_at` is the only code that reads a cell's value out of `grid`; this only
    # measures how far a row can possibly reach, the same kind of structural look
    # `_last_row` takes, never a cell's value.
    width = max((len(row) for row in grid), default=0)
    present: list[str] = []
    for column in range(1, width + 1):
        value = _at(grid, layout.TITLE_ROW, column)
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


def _read_varieties(grid: _Grid, problems: list[CellProblem]) -> tuple[VarietyRow, ...]:
    rows: list[VarietyRow] = []
    for row_number in range(layout.VARIETY_FIRST_ROW, layout.VARIETY_LAST_ROW + 1):
        raw_name = _at(grid, row_number, layout.VARIETY_NAME_COLUMN)
        raw_threshold = _at(grid, row_number, layout.VARIETY_THRESHOLD_COLUMN)
        if _is_blank(raw_name) and _is_blank(raw_threshold):
            continue
        ref = SheetRef(layout.AJUSTES_SHEET, row_number)
        row_problems: list[CellProblem] = []
        name = _field(
            row_problems, ref, layout.VARIETY_NAME_LABEL, _require_text_or_number, raw_name
        )
        threshold = _field(
            row_problems, ref, layout.VARIETY_THRESHOLD_LABEL, _to_quantity, raw_threshold
        )
        problems.extend(row_problems)
        if name is None:
            continue
        rows.append(VarietyRow(ref, name, threshold))
    return tuple(rows)


def _read_categories(grid: _Grid, problems: list[CellProblem]) -> tuple[CategoryRow, ...]:
    rows: list[CategoryRow] = []
    for row_number in range(layout.CATEGORY_FIRST_ROW, layout.CATEGORY_LAST_ROW + 1):
        raw_name = _at(grid, row_number, layout.CATEGORY_NAME_COLUMN)
        if _is_blank(raw_name):
            continue
        ref = SheetRef(layout.AJUSTES_SHEET, row_number)
        row_problems: list[CellProblem] = []
        name = _field(
            row_problems, ref, layout.CATEGORY_NAME_LABEL, _require_text_or_number, raw_name
        )
        problems.extend(row_problems)
        if name is None:
            continue
        rows.append(CategoryRow(ref, name))
    return tuple(rows)


def _read_price_history(grid: _Grid, problems: list[CellProblem]) -> tuple[PriceHistoryRow, ...]:
    rows: list[PriceHistoryRow] = []
    for row_number in range(layout.PRICE_HISTORY_FIRST_ROW, _last_row(grid) + 1):
        raw_variety = _at(grid, row_number, layout.PRICE_HISTORY_VARIETY_COLUMN)
        raw_effective = _at(grid, row_number, layout.PRICE_HISTORY_EFFECTIVE_COLUMN)
        raw_list_price = _at(grid, row_number, layout.PRICE_HISTORY_LIST_PRICE_COLUMN)
        raw_bulk_price = _at(grid, row_number, layout.PRICE_HISTORY_BULK_PRICE_COLUMN)
        raw_bulk_minimum = _at(grid, row_number, layout.PRICE_HISTORY_BULK_MINIMUM_COLUMN)
        if all(
            _is_blank(v)
            for v in (raw_variety, raw_effective, raw_list_price, raw_bulk_price, raw_bulk_minimum)
        ):
            continue
        ref = SheetRef(layout.AJUSTES_SHEET, row_number)
        row_problems: list[CellProblem] = []
        variety = _field(
            row_problems,
            ref,
            layout.PRICE_HISTORY_VARIETY_LABEL,
            _require_text_or_number,
            raw_variety,
        )
        effective = _field(
            row_problems, ref, layout.PRICE_HISTORY_EFFECTIVE_LABEL, _require_date, raw_effective
        )
        list_price = _field(
            row_problems, ref, layout.PRICE_HISTORY_LIST_PRICE_LABEL, _require_pesos, raw_list_price
        )
        bulk_price = _field(
            row_problems, ref, layout.PRICE_HISTORY_BULK_PRICE_LABEL, _to_pesos, raw_bulk_price
        )
        bulk_minimum = _field(
            row_problems, ref, layout.PRICE_HISTORY_BULK_MINIMUM_LABEL, _to_quantity, raw_bulk_minimum
        )
        problems.extend(row_problems)
        if variety is None or effective is None or list_price is None:
            continue
        rows.append(PriceHistoryRow(ref, variety, effective, list_price, bulk_price, bulk_minimum))
    return tuple(rows)


def _read_catalog(grid: _Grid, problems: list[CellProblem]) -> tuple[CatalogRow, ...]:
    rows: list[CatalogRow] = []
    for row_number in range(layout.CATALOG_FIRST_ROW, layout.CATALOG_LAST_ROW + 1):
        raw_variety = _at(grid, row_number, layout.CATALOG_VARIETY_COLUMN)
        raw_shown = _at(grid, row_number, layout.CATALOG_SHOWN_COLUMN)
        raw_emoji = _at(grid, row_number, layout.CATALOG_EMOJI_COLUMN)
        raw_indica = _at(grid, row_number, layout.CATALOG_INDICA_COLUMN)
        raw_aroma = _at(grid, row_number, layout.CATALOG_AROMA_COLUMN)
        if all(_is_blank(v) for v in (raw_variety, raw_shown, raw_emoji, raw_indica, raw_aroma)):
            continue
        ref = SheetRef(layout.CATALOGO_SHEET, row_number)
        row_problems: list[CellProblem] = []
        variety = _field(
            row_problems, ref, layout.CATALOG_VARIETY_LABEL, _require_text_or_number, raw_variety
        )
        shown = _field(
            row_problems, ref, layout.CATALOG_SHOWN_LABEL, _require_text_or_number, raw_shown
        )
        emoji = _field(row_problems, ref, layout.CATALOG_EMOJI_LABEL, _to_text, raw_emoji)
        indica = _field(row_problems, ref, layout.CATALOG_INDICA_LABEL, _to_indica, raw_indica)
        aroma = _field(row_problems, ref, layout.CATALOG_AROMA_LABEL, _to_text_or_number, raw_aroma)
        problems.extend(row_problems)
        if variety is None or shown is None:
            continue
        rows.append(CatalogRow(ref, variety, shown, emoji, indica, aroma))
    return tuple(rows)


def _read_header_footer(grid: _Grid, problems: list[CellProblem]) -> HeaderFooterCells:
    header_ref = SheetRef(layout.CATALOGO_SHEET, layout.HEADER_ROW)
    footer_ref = SheetRef(layout.CATALOGO_SHEET, layout.FOOTER_ROW)
    header_value = _at(grid, layout.HEADER_ROW, layout.HEADER_FOOTER_COLUMN)
    footer_value = _at(grid, layout.FOOTER_ROW, layout.HEADER_FOOTER_COLUMN)
    header = (
        _field(problems, header_ref, layout.HEADER_LABEL, _to_text_or_number, header_value) or ""
    )
    footer = (
        _field(problems, footer_ref, layout.FOOTER_LABEL, _to_text_or_number, footer_value) or ""
    )
    return HeaderFooterCells(header, footer)


def _read_ventas(grid: _Grid, problems: list[CellProblem]) -> tuple[VentaRow, ...]:
    all_titles = (*layout.VENTAS_TYPED_TITLES, layout.VENTAS_TOTAL_TITLE)
    columns, header_problems = _locate_columns(grid, layout.VENTAS_SHEET, all_titles)
    problems.extend(header_problems)
    if header_problems:
        return ()
    rows: list[VentaRow] = []
    not_recalculated = False
    for row_number in range(layout.DATA_FIRST_ROW, _last_row(grid) + 1):
        typed_raw = {
            title: _at(grid, row_number, columns[title]) for title in layout.VENTAS_TYPED_TITLES
        }
        if all(_is_blank(v) for v in typed_raw.values()):
            continue
        ref = SheetRef(layout.VENTAS_SHEET, row_number)
        sale_date = _field(
            problems, ref, layout.VENTAS_FECHA, _to_date, typed_raw[layout.VENTAS_FECHA]
        )
        variety = _field(
            problems,
            ref,
            layout.VENTAS_VARIEDAD,
            _to_text_or_number,
            typed_raw[layout.VENTAS_VARIEDAD],
        )
        quantity = _field(
            problems, ref, layout.VENTAS_GRAMOS, _to_quantity, typed_raw[layout.VENTAS_GRAMOS]
        )
        payment = _field(
            problems, ref, layout.VENTAS_PAGO, _to_text_or_number, typed_raw[layout.VENTAS_PAGO]
        )
        customer = _field(
            problems,
            ref,
            layout.VENTAS_CLIENTE,
            _to_text_or_number,
            typed_raw[layout.VENTAS_CLIENTE],
        )
        kind = _field(
            problems, ref, layout.VENTAS_TIPO, _to_text_or_number, typed_raw[layout.VENTAS_TIPO]
        )
        shipping = _field(
            problems,
            ref,
            layout.VENTAS_ENVIO_COBRADO,
            _to_pesos,
            typed_raw[layout.VENTAS_ENVIO_COBRADO],
        )
        special_total = _field(
            problems,
            ref,
            layout.VENTAS_PRECIO_ESPECIAL,
            _to_pesos,
            typed_raw[layout.VENTAS_PRECIO_ESPECIAL],
        )
        note = _field(
            problems, ref, layout.VENTAS_NOTA, _to_text_or_number, typed_raw[layout.VENTAS_NOTA]
        )
        total_value = _at(grid, row_number, columns[layout.VENTAS_TOTAL_TITLE])
        total = _read_total(total_value)
        if total is None:
            not_recalculated = True
        rows.append(
            VentaRow(
                ref,
                sale_date,
                variety,
                quantity,
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
                SheetRef(layout.VENTAS_SHEET, layout.NO_ROW),
                layout.VENTAS_TOTAL_TITLE,
                "not_recalculated",
            )
        )
    return tuple(rows)


def _read_total(value: _CellGetValue) -> int | Decimal | str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        # Never a number or text (the plan's invariant, every reader): a cached
        # Total can't sensibly be a bool either way, so it is treated the same as a
        # formula with nothing cached — `not_recalculated`, never a value.
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        # As in `_to_pesos`/`_to_indica`: cast through `Decimal`, never the float
        # itself. A non-whole number counts as a finished row all the same (the
        # plan's invariant): it is kept as the exact `Decimal`, never text.
        whole = _whole_or_none(value)
        return whole if whole is not None else Decimal(repr(value))
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return str(value)


def _read_entradas(grid: _Grid, problems: list[CellProblem]) -> tuple[EntradaRow, ...]:
    all_titles = (*layout.ENTRADAS_TYPED_TITLES, layout.ENTRADAS_REVISAR_TITLE)
    columns, header_problems = _locate_columns(grid, layout.ENTRADAS_SHEET, all_titles)
    problems.extend(header_problems)
    if header_problems:
        return ()
    rows: list[EntradaRow] = []
    for row_number in range(layout.DATA_FIRST_ROW, _last_row(grid) + 1):
        typed_raw = {
            title: _at(grid, row_number, columns[title]) for title in layout.ENTRADAS_TYPED_TITLES
        }
        if all(_is_blank(v) for v in typed_raw.values()):
            continue
        ref = SheetRef(layout.ENTRADAS_SHEET, row_number)
        entry_date = _field(
            problems, ref, layout.ENTRADAS_FECHA, _to_date, typed_raw[layout.ENTRADAS_FECHA]
        )
        variety = _field(
            problems,
            ref,
            layout.ENTRADAS_VARIEDAD,
            _to_text_or_number,
            typed_raw[layout.ENTRADAS_VARIEDAD],
        )
        quantity = _field(
            problems, ref, layout.ENTRADAS_GRAMOS, _to_quantity, typed_raw[layout.ENTRADAS_GRAMOS]
        )
        origin = _field(
            problems,
            ref,
            layout.ENTRADAS_ORIGEN,
            _to_text_or_number,
            typed_raw[layout.ENTRADAS_ORIGEN],
        )
        total_cost = _field(
            problems,
            ref,
            layout.ENTRADAS_COSTO_TOTAL,
            _to_pesos,
            typed_raw[layout.ENTRADAS_COSTO_TOTAL],
        )
        note = _field(
            problems, ref, layout.ENTRADAS_NOTA, _to_text_or_number, typed_raw[layout.ENTRADAS_NOTA]
        )
        revisar_value = _at(grid, row_number, columns[layout.ENTRADAS_REVISAR_TITLE])
        revisar = _field(problems, ref, layout.ENTRADAS_REVISAR_TITLE, _to_text, revisar_value)
        rows.append(EntradaRow(ref, entry_date, variety, quantity, origin, total_cost, note, revisar))
    return tuple(rows)


def _read_gastos(grid: _Grid, problems: list[CellProblem]) -> tuple[GastoRow, ...]:
    all_titles = (*layout.GASTOS_TYPED_TITLES, layout.GASTOS_REVISAR_TITLE)
    columns, header_problems = _locate_columns(grid, layout.GASTOS_SHEET, all_titles)
    problems.extend(header_problems)
    if header_problems:
        return ()
    rows: list[GastoRow] = []
    for row_number in range(layout.DATA_FIRST_ROW, _last_row(grid) + 1):
        typed_raw = {
            title: _at(grid, row_number, columns[title]) for title in layout.GASTOS_TYPED_TITLES
        }
        if all(_is_blank(v) for v in typed_raw.values()):
            continue
        ref = SheetRef(layout.GASTOS_SHEET, row_number)
        spent_on = _field(
            problems, ref, layout.GASTOS_FECHA, _to_date, typed_raw[layout.GASTOS_FECHA]
        )
        category = _field(
            problems,
            ref,
            layout.GASTOS_CATEGORIA,
            _to_text_or_number,
            typed_raw[layout.GASTOS_CATEGORIA],
        )
        amount = _field(
            problems, ref, layout.GASTOS_MONTO, _to_pesos, typed_raw[layout.GASTOS_MONTO]
        )
        detail = _field(
            problems,
            ref,
            layout.GASTOS_DETALLE,
            _to_text_or_number,
            typed_raw[layout.GASTOS_DETALLE],
        )
        revisar_value = _at(grid, row_number, columns[layout.GASTOS_REVISAR_TITLE])
        revisar = _field(problems, ref, layout.GASTOS_REVISAR_TITLE, _to_text, revisar_value)
        rows.append(GastoRow(ref, spent_on, category, amount, detail, revisar))
    return tuple(rows)


def read_workbook(path: Path) -> ParsedWorkbook:
    """Opens `path` with `read_only=True, data_only=True` (§8: no formula is
    evaluated, no link followed) and reads every sheet `layout.py` names, each in one
    `_grid` pass (GH-55: a Google Sheets export carries no stored dimension)."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        problems: list[CellProblem] = []
        ajustes = _grid(workbook[layout.AJUSTES_SHEET])
        catalogo = _grid(workbook[layout.CATALOGO_SHEET])
        ventas = _grid(workbook[layout.VENTAS_SHEET])
        entradas = _grid(workbook[layout.ENTRADAS_SHEET])
        gastos = _grid(workbook[layout.GASTOS_SHEET])

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
