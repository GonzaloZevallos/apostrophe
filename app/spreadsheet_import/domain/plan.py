"""The pure import plan (ADR-0014; the plan's invariants).

Pure over `domain/rows.py`'s parsed values and the owners' check results. This module
never imports `application`: the check results it needs are mirrored here as plain
dataclasses (`Refusal`, `VarietyKey`, `CustomerKey`, `SaleCheckInput`, `SaleCheck`),
field for field, the same shapes `application/ports.py` declares. The application layer
translates between the two; this module never sees an owner's object or a database id.

Three functions:

- `split(parsed) -> Split` decides, before any owner check runs, which Entradas, Gastos
  and Ventas rows are unfinished (Ventas: `total` holds text; Entradas/Gastos: `revisar`
  is non-blank) and reports them with the sheet's own text. A Ventas row whose `total`
  has no saved value at all, despite being a row the reader kept (so at least one typed
  column is filled in), is a blocking problem: the file was not recalculated.
- `sale_inputs(finished_ventas, variety_names) -> Sequence[SaleCheckInput | CellProblem]`
  turns each finished Ventas row into what sales' port needs, or the problem that blocks
  it before any owner is asked (an unknown variety, an unknown payment or kind value, a
  gift with a special total, or an `Amigo` row with no customer).
- `build_plan(split, mapping, checks) -> ImportPlan` runs every rule this import's
  domain owns: unknown and duplicate varieties, a category outside Ajustes A21:A28, a
  customer name missing from the mapping, merged spellings and categories, Amigo -> VIP,
  mismatches, write order and the counts for the report. The plan is writable only when
  it has no problems.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date

from app.shared.grams import Grams
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

# -- Mirrors of application/ports.py's result shapes (the plan's invariant: domain/
# -- imports only the standard library, its own package and app.shared). -------------


@dataclass(frozen=True)
class Refusal:
    """An owner's own refusal, carried as its `code` alone."""

    code: str


@dataclass(frozen=True)
class VarietyKey:
    """Mirrors `application.ports.VarietyKey`."""

    key: str
    name: str


@dataclass(frozen=True)
class CustomerKey:
    """Mirrors `application.ports.CustomerKey`. Never printed."""

    phone_key: str


@dataclass(frozen=True)
class SaleCheckInput:
    """Mirrors `application.ports.SaleCheckInput`: one Ventas row, already
    interpreted, ready for sales' port."""

    variety_key: str
    grams: Grams
    has_customer: bool
    vip: bool
    gift: bool
    special_total: int | None
    shipping: int
    method: str | None
    left_owing: bool
    sale_date: date
    note: str | None


@dataclass(frozen=True)
class SaleCheck:
    """Mirrors `application.ports.SaleCheck`: the result of checking one
    `SaleCheckInput`."""

    total: int | None
    refusal: Refusal | None


# -- split -----------------------------------------------------------------------------


@dataclass(frozen=True)
class UnfinishedRow:
    """A row the sheet itself marks unfinished, with its own text, for the report."""

    ref: SheetRef
    sheet: str
    text: str


@dataclass(frozen=True)
class Split:
    """`parsed`, with Entradas, Gastos and Ventas partitioned into finished and
    unfinished. Every other sheet passes through unchanged: it has no concept of an
    unfinished row."""

    varieties: tuple[VarietyRow, ...]
    price_history: tuple[PriceHistoryRow, ...]
    catalog: tuple[CatalogRow, ...]
    header_footer: HeaderFooterCells
    categories: tuple[CategoryRow, ...]
    entradas: tuple[EntradaRow, ...]
    gastos: tuple[GastoRow, ...]
    ventas: tuple[VentaRow, ...]
    unfinished: tuple[UnfinishedRow, ...]
    problems: tuple[CellProblem, ...]


def split(parsed: ParsedWorkbook) -> Split:
    entradas: list[EntradaRow] = []
    gastos: list[GastoRow] = []
    ventas: list[VentaRow] = []
    unfinished: list[UnfinishedRow] = []
    problems: list[CellProblem] = list(parsed.problems)

    for entrada in parsed.entradas:
        if entrada.revisar:
            unfinished.append(UnfinishedRow(entrada.ref, "Entradas", entrada.revisar))
        else:
            entradas.append(entrada)

    for gasto in parsed.gastos:
        if gasto.revisar:
            unfinished.append(UnfinishedRow(gasto.ref, "Gastos", gasto.revisar))
        else:
            gastos.append(gasto)

    for venta in parsed.ventas:
        if isinstance(venta.total, str):
            unfinished.append(UnfinishedRow(venta.ref, "Ventas", venta.total))
        elif venta.total is None:
            problems.append(CellProblem(venta.ref, "Total", "import.total_not_recalculated"))
        else:
            ventas.append(venta)

    return Split(
        varieties=parsed.varieties,
        price_history=parsed.price_history,
        catalog=parsed.catalog,
        header_footer=parsed.header_footer,
        categories=parsed.categories,
        entradas=tuple(entradas),
        gastos=tuple(gastos),
        ventas=tuple(ventas),
        unfinished=tuple(unfinished),
        problems=tuple(problems),
    )


# -- sale_inputs -------------------------------------------------------------------------

_KNOWN_PAYMENTS = ("Efectivo", "Transferencia")
_KNOWN_KINDS = ("", "Lista", "Amigo", "Regalo")


def sale_inputs(
    finished_ventas: Sequence[VentaRow],
    variety_names: Mapping[str, VarietyKey | Refusal],
) -> Sequence[SaleCheckInput | CellProblem]:
    """One `SaleCheckInput` per row, ready for sales' port, or the `CellProblem` that
    blocks it before any owner is asked. A finished row always has a date, a variety
    and grams (any of them missing would have made the sheet's own `Total` text,
    leaving the row unfinished), so only payment, kind, variety and the gift/special
    combination are checked here."""
    results: list[SaleCheckInput | CellProblem] = []
    for row in finished_ventas:
        assert row.sale_date is not None
        assert row.grams is not None

        variety_result = variety_names.get(row.variety or "")
        if variety_result is None or isinstance(variety_result, Refusal):
            results.append(CellProblem(row.ref, "Variedad", "import.unknown_variety"))
            continue

        kind = row.kind or ""
        if kind not in _KNOWN_KINDS:
            results.append(CellProblem(row.ref, "Tipo", "import.kind_unknown"))
            continue
        vip = kind == "Amigo"
        gift = kind == "Regalo"

        if gift and row.special_total is not None:
            results.append(
                CellProblem(row.ref, "Precio especial (total)", "import.gift_with_special_total")
            )
            continue

        has_customer = row.customer is not None
        if vip and not has_customer:
            results.append(CellProblem(row.ref, "Cliente", "import.amigo_without_customer"))
            continue

        if row.payment == "Pendiente":
            left_owing = True
            method = None
        elif row.payment in _KNOWN_PAYMENTS:
            left_owing = False
            method = row.payment
        else:
            results.append(CellProblem(row.ref, "Pago", "import.payment_unknown"))
            continue

        results.append(
            SaleCheckInput(
                variety_key=variety_result.key,
                grams=row.grams,
                has_customer=has_customer,
                vip=vip,
                gift=gift,
                special_total=row.special_total,
                shipping=row.shipping if row.shipping is not None else 0,
                method=method,
                left_owing=left_owing,
                sale_date=row.sale_date,
                note=row.note,
            )
        )
    return results
