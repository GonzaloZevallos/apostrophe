"""Small builders for `domain/rows.py` values, so each test states only the fields it
cares about (CODING_STANDARDS.md section 5: no infrastructure, no real workbook).
"""

from __future__ import annotations

from datetime import date

from app.shared.grams import Grams
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


def variety_row(row: int, name: str, threshold: Grams | None = None) -> VarietyRow:
    return VarietyRow(ref=ref("Ajustes", row), raw_name=name, threshold=threshold)


def price_row(
    row: int,
    variety: str,
    effective: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Grams | None = None,
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
    grams: Grams | None = None,
    origin: str | None = "Compra",
    total_cost: int | None = 1000,
    note: str | None = None,
    revisar: str | None = None,
) -> EntradaRow:
    return EntradaRow(
        ref=ref("Entradas", row),
        entry_date=entry_date,
        variety=variety,
        grams=grams if grams is not None else Grams.of(10),
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
    grams: Grams | None = None,
    payment: str | None = "Efectivo",
    customer: str | None = None,
    kind: str | None = "",
    shipping: int | None = None,
    special_total: int | None = None,
    note: str | None = None,
    total: int | str | None = 1000,
) -> VentaRow:
    return VentaRow(
        ref=ref("Ventas", row),
        sale_date=sale_date,
        variety=variety,
        grams=grams if grams is not None else Grams.of(10),
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
