"""The only place a sheet name, a fixed cell, a row number or a header title is
named (the plan's invariant). `adapters/cells.py` reads by these constants alone,
both for locating a cell and for labelling a `CellProblem`; nothing here reads a
cell.

The exact columns of Ajustes' fixed areas (varieties, categories, price history) are
not given by the product definition beyond the cells it does name (F7:F16 for
thresholds; rows 7-16, A21:A28 and "from row 37"). This module fixes the remaining
columns to the first ones free in each area, documented beside each constant. The
known risk the plan records stands: the first proof against a real export is the
operator's dry run.
"""

from __future__ import annotations

# A `SheetRef` needs a row; `not_recalculated` is workbook-wide, not one row's
# problem, so it is reported against this sentinel instead of a real row number.
NO_ROW = 0

# Ajustes: the sheet holding varieties, their thresholds, expense categories and the
# price history, each in its own fixed area.
AJUSTES_SHEET = "Ajustes"

# Rows 7-16: the complete list of varieties. Column A names each variety; F7:F16 (the
# product definition's own cells) holds its low-stock threshold. Neither has a header
# title, so each is given its own fixed problem label below.
VARIETY_FIRST_ROW = 7
VARIETY_LAST_ROW = 16
VARIETY_NAME_COLUMN = 1  # A
VARIETY_THRESHOLD_COLUMN = 6  # F
VARIETY_NAME_LABEL = "Variedad"
VARIETY_THRESHOLD_LABEL = "F"

# A21:A28: expense category names.
CATEGORY_FIRST_ROW = 21
CATEGORY_LAST_ROW = 28
CATEGORY_NAME_COLUMN = 1  # A
CATEGORY_NAME_LABEL = "Categoría"

# From row 37, open-ended: one price entry per row.
PRICE_HISTORY_FIRST_ROW = 37
PRICE_HISTORY_VARIETY_COLUMN = 1  # A
PRICE_HISTORY_EFFECTIVE_COLUMN = 2  # B
PRICE_HISTORY_LIST_PRICE_COLUMN = 3  # C
PRICE_HISTORY_BULK_PRICE_COLUMN = 4  # D
PRICE_HISTORY_BULK_MINIMUM_COLUMN = 5  # E
PRICE_HISTORY_VARIETY_LABEL = "Variedad"
PRICE_HISTORY_EFFECTIVE_LABEL = "Rige desde"
PRICE_HISTORY_LIST_PRICE_LABEL = "Precio lista"
PRICE_HISTORY_BULK_PRICE_LABEL = "Precio por cantidad"
PRICE_HISTORY_BULK_MINIMUM_LABEL = "Cantidad mínima"

# Catálogo: rows 6-15 hold one variety's attributes each; B18 and B19 the header and
# footer. None of the five attribute columns has a header title either.
CATALOGO_SHEET = "Catálogo"
CATALOG_FIRST_ROW = 6
CATALOG_LAST_ROW = 15
CATALOG_VARIETY_COLUMN = 1  # A
CATALOG_SHOWN_COLUMN = 2  # B
CATALOG_EMOJI_COLUMN = 3  # C
CATALOG_INDICA_COLUMN = 4  # D
CATALOG_AROMA_COLUMN = 5  # E
CATALOG_VARIETY_LABEL = "Variedad"
CATALOG_SHOWN_LABEL = "Mostrado"
CATALOG_EMOJI_LABEL = "Emoji"
CATALOG_INDICA_LABEL = "% índica"
CATALOG_AROMA_LABEL = "Aroma"
HEADER_ROW = 18
FOOTER_ROW = 19
HEADER_FOOTER_COLUMN = 2  # B
HEADER_LABEL = "B18"
FOOTER_LABEL = "B19"

# Ventas, Entradas and Gastos: titles on row 1, data from row 2, columns found by
# exact title after trimming (the Human's answer, 2026-10-04). Each title is named
# once here; `cells.py` never repeats one as a literal.
TITLE_ROW = 1
DATA_FIRST_ROW = 2

VENTAS_SHEET = "Ventas"
VENTAS_FECHA = "Fecha"
VENTAS_VARIEDAD = "Variedad"
VENTAS_GRAMOS = "Gramos"
VENTAS_PAGO = "Pago"
VENTAS_CLIENTE = "Cliente"
VENTAS_TIPO = "Tipo"
VENTAS_ENVIO_COBRADO = "Envío cobrado"
VENTAS_PRECIO_ESPECIAL = "Precio especial (total)"
VENTAS_NOTA = "Nota"
VENTAS_TOTAL_TITLE = "Total"
VENTAS_TYPED_TITLES = (
    VENTAS_FECHA,
    VENTAS_VARIEDAD,
    VENTAS_GRAMOS,
    VENTAS_PAGO,
    VENTAS_CLIENTE,
    VENTAS_TIPO,
    VENTAS_ENVIO_COBRADO,
    VENTAS_PRECIO_ESPECIAL,
    VENTAS_NOTA,
)

ENTRADAS_SHEET = "Entradas"
ENTRADAS_FECHA = "Fecha"
ENTRADAS_VARIEDAD = "Variedad"
ENTRADAS_GRAMOS = "Gramos"
ENTRADAS_ORIGEN = "Origen"
ENTRADAS_COSTO_TOTAL = "Costo total"
ENTRADAS_NOTA = "Nota"
ENTRADAS_REVISAR_TITLE = "Revisar"
ENTRADAS_TYPED_TITLES = (
    ENTRADAS_FECHA,
    ENTRADAS_VARIEDAD,
    ENTRADAS_GRAMOS,
    ENTRADAS_ORIGEN,
    ENTRADAS_COSTO_TOTAL,
    ENTRADAS_NOTA,
)

GASTOS_SHEET = "Gastos"
GASTOS_FECHA = "Fecha"
GASTOS_CATEGORIA = "Categoría"
GASTOS_MONTO = "Monto"
GASTOS_DETALLE = "Detalle"
GASTOS_REVISAR_TITLE = "Revisar"
GASTOS_TYPED_TITLES = (
    GASTOS_FECHA,
    GASTOS_CATEGORIA,
    GASTOS_MONTO,
    GASTOS_DETALLE,
)

# The mapping file: not a sheet, but given the same `SheetRef` shape (CONTEXT.md: the
# spreadsheet import) so every problem, from a workbook or from the mapping, is
# located the same way.
MAPPING_FILE = "Mapping"
MAPPING_HEADER = ("name", "phone")
MAPPING_HEADER_LABEL = "header"
MAPPING_ROW_LABEL = "row"
MAPPING_NAME_LABEL = "name"

# Eligibility (ADR-0018): the one problem that precedes any sheet read. Not a real
# sheet either, but the same `SheetRef` shape, located by this fixed label alone.
BUSINESS_SHEET = "Negocio"
