"""The only place a sheet name, a fixed cell or a header title is named (the plan's
invariant). `adapters/cells.py` reads by these constants alone; nothing here reads a
cell.

The exact columns of Ajustes' fixed areas (varieties, categories, price history) are
not given by the product definition beyond the cells it does name (F7:F16 for
thresholds; rows 7-16, A21:A28 and "from row 37"). This module fixes the remaining
columns to the first ones free in each area, documented beside each constant. The
known risk the plan records stands: the first proof against a real export is the
operator's dry run.
"""

from __future__ import annotations

# Ajustes: the sheet holding varieties, their thresholds, expense categories and the
# price history, each in its own fixed area.
AJUSTES_SHEET = "Ajustes"

# Rows 7-16: the complete list of varieties. Column A names each variety; F7:F16 (the
# product definition's own cells) holds its low-stock threshold.
VARIETY_FIRST_ROW = 7
VARIETY_LAST_ROW = 16
VARIETY_NAME_COLUMN = 1  # A
VARIETY_THRESHOLD_COLUMN = 6  # F

# A21:A28: expense category names.
CATEGORY_FIRST_ROW = 21
CATEGORY_LAST_ROW = 28
CATEGORY_NAME_COLUMN = 1  # A

# From row 37, open-ended: one price entry per row.
PRICE_HISTORY_FIRST_ROW = 37
PRICE_HISTORY_VARIETY_COLUMN = 1  # A
PRICE_HISTORY_EFFECTIVE_COLUMN = 2  # B
PRICE_HISTORY_LIST_PRICE_COLUMN = 3  # C
PRICE_HISTORY_BULK_PRICE_COLUMN = 4  # D
PRICE_HISTORY_BULK_MINIMUM_COLUMN = 5  # E

# Catálogo: rows 6-15 hold one variety's attributes each; B18 and B19 the header and
# footer.
CATALOGO_SHEET = "Catálogo"
CATALOG_FIRST_ROW = 6
CATALOG_LAST_ROW = 15
CATALOG_VARIETY_COLUMN = 1  # A
CATALOG_SHOWN_COLUMN = 2  # B
CATALOG_EMOJI_COLUMN = 3  # C
CATALOG_INDICA_COLUMN = 4  # D
CATALOG_AROMA_COLUMN = 5  # E
HEADER_ROW = 18
FOOTER_ROW = 19
HEADER_FOOTER_COLUMN = 2  # B

# Ventas, Entradas and Gastos: titles on row 1, data from row 2, columns found by
# exact title after trimming (the Human's answer, 2026-10-04).
TITLE_ROW = 1
DATA_FIRST_ROW = 2

VENTAS_SHEET = "Ventas"
VENTAS_TYPED_TITLES = (
    "Fecha",
    "Variedad",
    "Gramos",
    "Pago",
    "Cliente",
    "Tipo",
    "Envío cobrado",
    "Precio especial (total)",
    "Nota",
)
VENTAS_TOTAL_TITLE = "Total"

ENTRADAS_SHEET = "Entradas"
ENTRADAS_TYPED_TITLES = (
    "Fecha",
    "Variedad",
    "Gramos",
    "Origen",
    "Costo total",
    "Nota",
)
ENTRADAS_REVISAR_TITLE = "Revisar"

GASTOS_SHEET = "Gastos"
GASTOS_TYPED_TITLES = (
    "Fecha",
    "Categoría",
    "Monto",
    "Detalle",
)
GASTOS_REVISAR_TITLE = "Revisar"

# The mapping file: not a sheet, but given the same `SheetRef` shape (CONTEXT.md: the
# spreadsheet import) so every problem, from a workbook or from the mapping, is
# located the same way.
MAPPING_FILE = "Mapping"
MAPPING_HEADER = ("name", "phone")
