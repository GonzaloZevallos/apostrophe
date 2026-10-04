"""The rows a workbook or a mapping file holds, and the problems found reading them
(CONTEXT.md: the spreadsheet import).

Every type here is a frozen dataclass of plain values: no owner's domain object and no
database id crosses into this module (the plan's invariant). Only
`app/spreadsheet_import/adapters/cells.py` turns a cell into one of these fields, and
only `adapters/layout.py` names a sheet, a cell, a row number or a header title — this
module just holds what they produce.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.shared.grams import Grams


@dataclass(frozen=True)
class SheetRef:
    """Where a row or a mapping line came from, for every problem the import
    reports. `sheet` is a tab name such as `"Ventas"`, or a fixed label for the
    mapping file; `row` is a sheet row number or a mapping line number."""

    sheet: str
    row: int


@dataclass(frozen=True)
class VarietyRow:
    """One row of Ajustes 7-16: the sheet's complete list of varieties, with its
    low-stock threshold read from the same row (F7:F16)."""

    ref: SheetRef
    raw_name: str
    threshold: Grams | None


@dataclass(frozen=True)
class PriceHistoryRow:
    """One row of Ajustes from row 37: a single price entry, read as varieties.md
    would take it if typed in by hand today."""

    ref: SheetRef
    variety: str
    effective: date
    list_price: int
    bulk_price: int | None
    bulk_minimum: Grams | None


@dataclass(frozen=True)
class CatalogRow:
    """One row of Catálogo 6-15. `shown` is the raw cell text ("Sí", "No", or
    anything else); only the domain maps it to a boolean, so a bad value is reported
    rather than silently taken as one or the other."""

    ref: SheetRef
    variety: str
    shown: str
    emoji: str | None
    indica: int | str | None
    aroma: str | None


@dataclass(frozen=True)
class HeaderFooterCells:
    """Catálogo B18 and B19, read as plain text."""

    header: str
    footer: str


@dataclass(frozen=True)
class CategoryRow:
    """One row of Ajustes A21:A28: an expense category name."""

    ref: SheetRef
    raw_name: str


@dataclass(frozen=True)
class EntradaRow:
    """One row of Entradas: its typed columns only, never the formula ones (Gramos
    válidos, Costo válido, Gramos con costo). `revisar` is the sheet's own Revisar
    text, blank when the row is finished; read only to decide whether the row is
    left out, never stored (the plan's invariant)."""

    ref: SheetRef
    entry_date: date | None
    variety: str | None
    grams: Grams | None
    origin: str | None
    total_cost: int | None
    note: str | None
    revisar: str | None


@dataclass(frozen=True)
class GastoRow:
    """One row of Gastos: its typed columns only. `revisar` is read only to decide
    whether the row is left out, never stored."""

    ref: SheetRef
    spent_on: date | None
    category: str | None
    amount: int | None
    detail: str | None
    revisar: str | None


@dataclass(frozen=True)
class VentaRow:
    """One row of Ventas: one sale with one line. `total` is the sheet's own cached
    Total cell — a number when the row is finished, the sheet's own text for an
    unfinished row (for example `"Falta pago"`), or `None` when the formula has no
    saved value at all. Never stored: read only to decide whether the row is
    finished, and, when it is, to report a mismatch against the recomputed total."""

    ref: SheetRef
    sale_date: date | None
    variety: str | None
    grams: Grams | None
    payment: str | None
    customer: str | None
    kind: str | None
    shipping: int | None
    special_total: int | None
    note: str | None
    total: int | str | None


@dataclass(frozen=True)
class MappingEntry:
    """One line of the mapping CSV. `phone` is read only by
    `adapters/mapping.py` and passed only to customers' port: nothing else in the
    import prints it (the plan's invariant)."""

    line: int
    name: str
    phone: str


@dataclass(frozen=True)
class CellProblem:
    """A single problem found while reading the workbook or the mapping file,
    located by `ref` and a fixed `kind` slug such as `"grams_not_numeric"` or
    `"column_missing"` — never by the value that broke the rule, so a problem can be
    printed without repeating what it was about."""

    ref: SheetRef
    column: str
    kind: str


@dataclass(frozen=True)
class ParsedWorkbook:
    """Every row the workbook holds, grouped by tab, plus every problem found while
    reading cells. Rows are in sheet order; nothing here is skipped, split into
    finished and unfinished, merged, or checked against an owner — that is
    `domain/plan.py`'s and `application/plan_import.py`'s job."""

    varieties: tuple[VarietyRow, ...]
    price_history: tuple[PriceHistoryRow, ...]
    catalog: tuple[CatalogRow, ...]
    header_footer: HeaderFooterCells
    categories: tuple[CategoryRow, ...]
    entradas: tuple[EntradaRow, ...]
    gastos: tuple[GastoRow, ...]
    ventas: tuple[VentaRow, ...]
    problems: tuple[CellProblem, ...]


@dataclass(frozen=True)
class ParsedMapping:
    """Every entry the mapping CSV holds, plus every problem found reading it."""

    entries: tuple[MappingEntry, ...]
    problems: tuple[CellProblem, ...]
