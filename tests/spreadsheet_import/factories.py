"""Small builders for `domain/rows.py` values, so each test states only the fields it
cares about (CODING_STANDARDS.md section 5: no infrastructure, no real workbook), plus
`as_google_export`, which rewrites an already-saved `.xlsx`'s zip in place so it reads
the way a Google Sheets export does (GH-55): no worksheet keeps a real `<dimension>`
element and every numeric cell is stored as a float. The test that calls it still
builds the workbook itself with openpyxl; nothing here saves a real sheet.
"""

from __future__ import annotations

import re
import zipfile
from datetime import date
from decimal import Decimal
from pathlib import Path
from re import Match

from app.shared.quantity import Quantity
from app.spreadsheet_import.domain.rows import (
    CatalogRow,
    CategoryRow,
    CellProblem,
    EntradaRow,
    GastoRow,
    HeaderFooterCells,
    MappingEntry,
    ParsedMapping,
    ParsedWorkbook,
    PriceHistoryRow,
    SheetRef,
    VarietyRow,
    VentaRow,
)

EMPTY_HEADER_FOOTER = HeaderFooterCells(header="", footer="")


def ref(sheet: str, row: int) -> SheetRef:
    return SheetRef(sheet, row)


def variety_row(row: int, name: str, threshold: Quantity | None = None) -> VarietyRow:
    return VarietyRow(ref=ref("Ajustes", row), raw_name=name, threshold=threshold)


def price_row(
    row: int,
    variety: str,
    effective: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Quantity | None = None,
) -> PriceHistoryRow:
    return PriceHistoryRow(
        ref=ref("Ajustes", row),
        variety=variety,
        effective=effective,
        list_price=list_price,
        bulk_price=bulk_price,
        bulk_minimum=bulk_minimum,
    )


def catalog_row(
    row: int,
    variety: str,
    shown: str = "Sí",
    emoji: str | None = None,
    indica: int | str | None = None,
    aroma: str | None = None,
) -> CatalogRow:
    return CatalogRow(
        ref=ref("Catálogo", row),
        variety=variety,
        shown=shown,
        emoji=emoji,
        indica=indica,
        aroma=aroma,
    )


def category_row(row: int, name: str) -> CategoryRow:
    return CategoryRow(ref=ref("Ajustes", row), raw_name=name)


def entrada_row(
    row: int,
    *,
    entry_date: date | None = date(2026, 1, 1),
    variety: str | None = "Variedad A",
    quantity: Quantity | None = None,
    origin: str | None = "Compra",
    total_cost: int | None = 1000,
    note: str | None = None,
    revisar: str | None = None,
) -> EntradaRow:
    return EntradaRow(
        ref=ref("Entradas", row),
        entry_date=entry_date,
        variety=variety,
        quantity=quantity if quantity is not None else Quantity.of(10),
        origin=origin,
        total_cost=total_cost,
        note=note,
        revisar=revisar,
    )


def gasto_row(
    row: int,
    *,
    spent_on: date | None = date(2026, 1, 1),
    category: str | None = "Insumos",
    amount: int | None = 1000,
    detail: str | None = "detalle",
    revisar: str | None = None,
) -> GastoRow:
    return GastoRow(
        ref=ref("Gastos", row),
        spent_on=spent_on,
        category=category,
        amount=amount,
        detail=detail,
        revisar=revisar,
    )


def venta_row(
    row: int,
    *,
    sale_date: date | None = date(2026, 1, 1),
    variety: str | None = "Variedad A",
    quantity: Quantity | None = None,
    payment: str | None = "Efectivo",
    customer: str | None = None,
    kind: str | None = "",
    shipping: int | None = None,
    special_total: int | None = None,
    note: str | None = None,
    total: int | Decimal | str | None = 1000,
) -> VentaRow:
    return VentaRow(
        ref=ref("Ventas", row),
        sale_date=sale_date,
        variety=variety,
        quantity=quantity if quantity is not None else Quantity.of(10),
        payment=payment,
        customer=customer,
        kind=kind,
        shipping=shipping,
        special_total=special_total,
        note=note,
        total=total,
    )


def workbook(
    *,
    varieties: tuple[VarietyRow, ...] = (),
    price_history: tuple[PriceHistoryRow, ...] = (),
    catalog: tuple[CatalogRow, ...] = (),
    header_footer: HeaderFooterCells = EMPTY_HEADER_FOOTER,
    categories: tuple[CategoryRow, ...] = (),
    entradas: tuple[EntradaRow, ...] = (),
    gastos: tuple[GastoRow, ...] = (),
    ventas: tuple[VentaRow, ...] = (),
    problems: tuple[CellProblem, ...] = (),
) -> ParsedWorkbook:
    return ParsedWorkbook(
        varieties=varieties,
        price_history=price_history,
        catalog=catalog,
        header_footer=header_footer,
        categories=categories,
        entradas=entradas,
        gastos=gastos,
        ventas=ventas,
        problems=problems,
    )


def mapping(
    *, entries: tuple[MappingEntry, ...] = (), problems: tuple[CellProblem, ...] = ()
) -> ParsedMapping:
    return ParsedMapping(entries=entries, problems=problems)


# -- The Google Sheets export shape (GH-55) -------------------------------------------

_SHEET_XML_NAME = re.compile(r"xl/worksheets/sheet\d+\.xml")
_DIMENSION = re.compile(r"<dimension[^/]*/>")
_T_ATTRIBUTE = re.compile(r'\bt="([^"]*)"')
_INTEGER_VALUE = re.compile(r"(<v>)(-?\d+)(</v>)")
# A self-closing `<c .../>` (an empty cell, e.g. an inline string with nothing in
# it) is tried first: without it, the lazy `(.*?)</c>` below would cross straight
# over it looking for the next `</c>`, swallowing the following cell's own content
# along with it and leaving a numeric cell right after an empty one untouched.
_CELL = re.compile(r"<c\b[^>]*/>|<c\b(?P<attrs>[^>]*)>(?P<inner>.*?)</c>", re.DOTALL)


def _floatify_numeric_cells(xml: str) -> str:
    def cell(match: Match[str]) -> str:
        attributes = match.group("attrs")
        if attributes is None:
            return match.group(0)  # a self-closing, empty cell: nothing to floatify
        inner = match.group("inner")
        type_match = _T_ATTRIBUTE.search(attributes)
        # No `t` attribute at all means numeric too (the OOXML default).
        cell_type = type_match.group(1) if type_match else "n"
        if cell_type != "n":
            return match.group(0)
        new_inner = _INTEGER_VALUE.sub(
            lambda m: f"{m.group(1)}{m.group(2)}.0{m.group(3)}", inner
        )
        return f"<c{attributes}>{new_inner}</c>"

    return _CELL.sub(cell, xml)


def as_google_export(path: Path, *, a1_dimension: bool = False) -> None:
    """Rewrites `path`'s zip in place so it reads the way a Google Sheets `.xlsx`
    export does (GH-55's reproduction, proven against the mechanism, not just read
    from the code): every worksheet loses its `<dimension>` element — blank by
    default, `ref="A1"` when `a1_dimension` is set, the other shape Sheets is seen to
    write — and every numeric cell (no `t` attribute, or `t="n"`) carries a decimal
    point, never a bare integer. A boolean or shared/inline-string cell (`t="b"`,
    `t="s"`, `t="inlineStr"`) is untouched."""
    with zipfile.ZipFile(path) as source:
        names = source.namelist()
        contents = {name: source.read(name) for name in names}
    dimension_replacement = '<dimension ref="A1" />' if a1_dimension else ""
    for name in names:
        if not _SHEET_XML_NAME.fullmatch(name):
            continue
        xml = contents[name].decode("utf-8")
        xml = _DIMENSION.sub(dimension_replacement, xml)
        xml = _floatify_numeric_cells(xml)
        contents[name] = xml.encode("utf-8")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as out:
        for name in names:
            out.writestr(name, contents[name])
