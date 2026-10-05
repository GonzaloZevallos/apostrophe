"""The pure import plan (ADR-0018; ADR-0019; the plan's invariants).

Pure over `domain/rows.py`'s parsed values and the owners' check results. This module
never imports `application`: the check results it needs are mirrored here as plain
dataclasses (`Refusal`, `VarietyKey`, `CustomerKey`, `CustomerRefusal`, `SaleCheckInput`,
`SaleCheck`), field for field, the same shapes `application/ports.py` declares. The
application layer translates between the two; this module never sees an owner's object
or a database id.

Four functions:

- `split(parsed) -> Split` decides, before any owner check runs, which Entradas, Gastos
  and Ventas rows are unfinished (Ventas: `total` holds text; Entradas/Gastos: `revisar`
  is non-blank) and reports them with the sheet's own text. A Ventas row whose `total`
  has no saved value at all, despite being a row the reader kept (so at least one typed
  column is filled in), is a blocking problem: the file was not recalculated.
- `sale_inputs(finished_ventas, variety_names) -> Sequence[SaleCheckInput | CellProblem]`
  turns each finished Ventas row into what sales' port needs, or the problem that blocks
  it before any owner is asked (an unknown variety, an unknown payment or kind value, a
  gift with a special total, or an `Amigo` row with no customer).
- `customer_mentions(split, mapping) -> tuple[CustomerMention, ...]` is the one place
  that decides which distinct collapsed customer names `check_customer` must be asked
  about, and with what phone: once per collapsed name on a finished Ventas row (the
  mapped phone, or `None`), and once per mapping entry whose name is on no finished row
  (kept only to still catch a malformed phone there). `application/plan_import.py` and
  `build_plan` both call this same pure function, so they always agree.
- `build_plan(split, mapping, checks) -> ImportPlan` runs every rule this import's
  domain owns: unknown and duplicate varieties, a category outside Ajustes A21:A28,
  merged spellings and categories, Amigo -> VIP, mismatches, write order and the counts
  for the report. The plan is writable only when it has no problems.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date

from app.shared.grams import Grams
from app.shared.names import collapse_spaces
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
    """Mirrors `application.ports.CustomerKey`: the normalised phone key, or `None`
    for a customer with no phone at all (ADR-0019). Never printed: `repr=False` so an
    assertion message or a traceback involving this value never shows it either (the
    plan's invariant: no phone number appears in any report line, exception message,
    stdout or stderr)."""

    phone_key: str | None = field(repr=False)


@dataclass(frozen=True)
class CustomerRefusal:
    """Mirrors `application.ports.CustomerRefusals`: every broken rule
    `check_customer` found, filed by the field it answers in. At least one is set."""

    name_code: str | None
    phone_code: str | None


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


# -- Customer identity (ADR-0019): a planned customer is keyed by a tagged identity,
# -- never by an untagged string that could be either a phone or a name. -------------


@dataclass(frozen=True)
class ByPhone:
    """Identifies a planned customer by their normalised phone key: one or more
    spellings mapped to the same number share this identity."""

    phone_key: str = field(repr=False)


@dataclass(frozen=True)
class ByName:
    """Identifies a planned customer with no phone number at all, by their own
    collapsed name (trimmed, inner spaces collapsed, case kept). Each distinct
    collapsed name with no number is its own customer: nothing is merged by guess.
    `repr=False`: this identity is also a dict key in `write_import.py`, so a
    traceback over a `KeyError` there never shows the name either."""

    collapsed_name: str = field(repr=False)


CustomerIdentity = ByPhone | ByName


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
    combination are checked here. A blank `Pago` is accepted provisionally (left not
    owing, no method): the sheet's own formula never requires one for a `Regalo` row,
    and `build_plan` applies the $0 rule (no method, nothing owed) once the checked
    total is known; a non-gift, non-$0 sale with no method is still refused, by the
    owner's own rule, not restated here."""
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
        elif row.payment is None:
            # Only a `Regalo` row's `Pago` can be blank on a finished row (the sheet's
            # own formula never requires it for a gift): left not owing, no method,
            # provisionally. The owner's own rule ("a total above $0 needs a payment
            # method") still applies through `check_sales` if this is not a $0 sale.
            left_owing = False
            method = None
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


# -- customer_mentions -------------------------------------------------------------------


@dataclass(frozen=True)
class CustomerMention:
    """One distinct collapsed customer name this import must ask customers' port
    about exactly once: either the first finished Ventas row naming them (`ref` set,
    `name` that row's own spelling) or a mapping entry whose name is on no finished
    row (`ref` is `None`, `name` the entry's own text, kept only to still catch a
    malformed phone there). `phone` is the matching mapping entry's own phone text,
    exactly as read, blank included: only `PhoneNumber.optional`, reached through
    `check_customer`, decides a blank one means no number. It is `None` only when no
    entry matched at all. `mapping_line` is that entry's line, when one matched, for
    filing a phone problem at the mapping file. `repr=False`: a traceback or an
    assertion message involving this value never shows the number either."""

    collapsed_name: str
    name: str
    phone: str | None = field(repr=False)
    ref: SheetRef | None
    mapping_line: int | None


def _entry_phone(entry: MappingEntry | None) -> str | None:
    return entry.phone if entry is not None else None


def customer_mentions(split: Split, mapping: ParsedMapping) -> tuple[CustomerMention, ...]:
    mapping_by_name: dict[str, MappingEntry] = {}
    for entry in mapping.entries:
        mapping_by_name.setdefault(collapse_spaces(entry.name), entry)

    rows_by_customer_name: dict[str, list[VentaRow]] = {}
    for venta in split.ventas:
        if venta.customer is None:
            continue
        rows_by_customer_name.setdefault(collapse_spaces(venta.customer), []).append(venta)

    mentions: list[CustomerMention] = []
    for collapsed in sorted(rows_by_customer_name):
        first_row = min(rows_by_customer_name[collapsed], key=lambda r: r.ref.row)
        assert first_row.customer is not None
        matching_entry = mapping_by_name.get(collapsed)
        mentions.append(
            CustomerMention(
                collapsed_name=collapsed,
                name=first_row.customer,
                phone=_entry_phone(matching_entry),
                ref=first_row.ref,
                mapping_line=matching_entry.line if matching_entry is not None else None,
            )
        )

    for collapsed, entry in mapping_by_name.items():
        if collapsed in rows_by_customer_name:
            continue
        mentions.append(
            CustomerMention(
                collapsed_name=collapsed,
                name=entry.name,
                phone=_entry_phone(entry),
                ref=None,
                mapping_line=entry.line,
            )
        )

    return tuple(mentions)


# -- build_plan --------------------------------------------------------------------------


@dataclass(frozen=True)
class HeaderFooterCheck:
    """The header/footer refusal, paired with the `ref` the caller used to ask for it.
    Domain never names a cell (the plan's invariant: only `adapters/layout.py` names a
    sheet, a cell or a row number): `ref` comes from the caller, which gets it from
    `layout.py`."""

    ref: SheetRef
    refusal: Refusal


@dataclass(frozen=True)
class Checks:
    """Every owner check's result, gathered by `application/plan_import.py` (not this
    module's job: domain never calls a port) and handed to `build_plan` in one bundle.
    Row-shaped results are keyed by `SheetRef`; name-shaped results by the raw text the
    owner was asked to check. `customers` is keyed by `CustomerMention.collapsed_name`
    (see `customer_mentions`), kept as plain mappings so a test builds only the
    entries its scenario needs. `mapping_sheet` is the fixed label the caller uses for
    the mapping file's own `SheetRef`s (again from `layout.py`, never invented here)."""

    variety_names: Mapping[str, VarietyKey | Refusal] = field(default_factory=dict)
    thresholds: Mapping[SheetRef, Refusal | None] = field(default_factory=dict)
    price_history: Mapping[SheetRef, Refusal | None] = field(default_factory=dict)
    catalog_attributes: Mapping[SheetRef, Refusal | None] = field(default_factory=dict)
    header_footer: HeaderFooterCheck | None = None
    category_names: Mapping[str, str | Refusal] = field(default_factory=dict)
    expenses: Mapping[SheetRef, Refusal | None] = field(default_factory=dict)
    entradas: Mapping[SheetRef, Refusal | None] = field(default_factory=dict)
    customers: Mapping[str, CustomerKey | CustomerRefusal] = field(default_factory=dict)
    sales: Mapping[SheetRef, SaleCheck] = field(default_factory=dict)
    mapping_sheet: str = ""


@dataclass(frozen=True)
class Mismatch:
    """One finished Ventas row whose sheet `Total` (shipping included) differs from
    the recomputed total. Never blocks."""

    ref: SheetRef
    sheet_total: int
    recomputed_total: int


@dataclass(frozen=True)
class MergedCategory:
    """Two or more Ajustes A21:A28 names that match under expenses.md's rule, become
    one category."""

    key: str
    names: tuple[str, ...]


@dataclass(frozen=True)
class PlannedCustomer:
    """One customer this import would write: one or more spellings sharing a phone
    number (`identity` a `ByPhone`), or exactly one collapsed name with no number
    (`identity` a `ByName`) — named after the spelling on the most recent finished
    Ventas row (ties: the lowest row in the sheet, i.e. the one furthest down, wins),
    VIP when any of those rows is a finished `Amigo` row."""

    kept_name: str
    spellings: tuple[str, ...]
    vip: bool
    identity: CustomerIdentity


@dataclass(frozen=True)
class PlannedSale:
    """One sale this import would write, paired with its final interpreted input.
    `method` and `left_owing` already apply the $0 rule (sales.md): once `total` is
    known to be $0, there is no method and nothing is owed, whatever the sheet's
    `Pago` column said."""

    ref: SheetRef
    variety_key: str
    customer_identity: CustomerIdentity | None
    vip: bool
    gift: bool
    method: str | None
    left_owing: bool
    total: int
    sale_date: date
    note: str | None


@dataclass(frozen=True)
class Counts:
    """Counts per kind of record, for the report."""

    varieties: int
    price_entries: int
    catalog_attributes: int
    stock_entries: int
    expense_categories: int
    expenses: int
    customers: int
    customers_without_phone: int
    sales: int
    payments: int


@dataclass(frozen=True)
class ImportPlan:
    """Every rule this import's domain owns, collected in one pass. Writable only
    when it has no problems."""

    problems: tuple[CellProblem, ...]
    unfinished: tuple[UnfinishedRow, ...]
    mismatches: tuple[Mismatch, ...]
    customers: tuple[PlannedCustomer, ...]
    merged_categories: tuple[MergedCategory, ...]
    unused_mapping_entries: tuple[str, ...]
    counts: Counts
    entrada_order: tuple[EntradaRow, ...]
    venta_order: tuple[VentaRow, ...]
    sales: tuple[PlannedSale, ...]

    @property
    def writable(self) -> bool:
        return not self.problems

    @property
    def merged_customers(self) -> tuple[PlannedCustomer, ...]:
        return tuple(customer for customer in self.customers if len(customer.spellings) > 1)


def _entrada_sort_key(row: EntradaRow) -> tuple[date, int]:
    assert row.entry_date is not None
    return (row.entry_date, row.ref.row)


def _venta_sort_key(row: VentaRow) -> tuple[date, int]:
    assert row.sale_date is not None
    return (row.sale_date, row.ref.row)


def _check_variety_mention(
    ref: SheetRef,
    raw: str | None,
    column: str,
    variety_names: Mapping[str, VarietyKey | Refusal],
    valid_keys: set[str],
    problems: list[CellProblem],
) -> None:
    if raw is None:
        return
    result = variety_names.get(raw)
    if isinstance(result, Refusal):
        problems.append(CellProblem(ref, column, result.code))
        return
    if result is None:
        return
    if result.key not in valid_keys:
        problems.append(CellProblem(ref, column, "import.unknown_variety"))


def build_plan(split: Split, mapping: ParsedMapping, checks: Checks) -> ImportPlan:
    problems: list[CellProblem] = [*split.problems, *mapping.problems]
    mismatches: list[Mismatch] = []

    # -- Varieties: resolve keys, block duplicates, build the valid-key set. ---------
    valid_variety_keys: set[str] = set()
    seen_variety_keys: set[str] = set()
    for row in split.varieties:
        result = checks.variety_names.get(row.raw_name)
        if isinstance(result, Refusal):
            problems.append(CellProblem(row.ref, "Variedad", result.code))
            continue
        if result is None:
            continue
        if result.key in seen_variety_keys:
            problems.append(CellProblem(row.ref, "Variedad", "import.duplicate_variety"))
            continue
        seen_variety_keys.add(result.key)
        valid_variety_keys.add(result.key)
        threshold_refusal = checks.thresholds.get(row.ref)
        if threshold_refusal is not None:
            problems.append(CellProblem(row.ref, "Umbral", threshold_refusal.code))

    for history_row in split.price_history:
        _check_variety_mention(
            history_row.ref,
            history_row.variety,
            "Variedad",
            checks.variety_names,
            valid_variety_keys,
            problems,
        )
        refusal = checks.price_history.get(history_row.ref)
        if refusal is not None:
            problems.append(CellProblem(history_row.ref, "Precio", refusal.code))

    for catalog_entry in split.catalog:
        _check_variety_mention(
            catalog_entry.ref,
            catalog_entry.variety,
            "Variedad",
            checks.variety_names,
            valid_variety_keys,
            problems,
        )
        refusal = checks.catalog_attributes.get(catalog_entry.ref)
        if refusal is not None:
            problems.append(CellProblem(catalog_entry.ref, "Catálogo", refusal.code))

    if checks.header_footer is not None:
        problems.append(
            CellProblem(
                checks.header_footer.ref, "header_footer", checks.header_footer.refusal.code
            )
        )

    for entrada in split.entradas:
        _check_variety_mention(
            entrada.ref,
            entrada.variety,
            "Variedad",
            checks.variety_names,
            valid_variety_keys,
            problems,
        )
        refusal = checks.entradas.get(entrada.ref)
        if refusal is not None:
            problems.append(CellProblem(entrada.ref, "Entradas", refusal.code))

    # -- Categories: match or merge Ajustes A21:A28, block an outside category. ------
    category_groups: dict[str, list[str]] = {}
    valid_category_keys: set[str] = set()
    for category_entry in split.categories:
        category_result = checks.category_names.get(category_entry.raw_name)
        if isinstance(category_result, Refusal):
            problems.append(CellProblem(category_entry.ref, "Categoría", category_result.code))
            continue
        if category_result is None:
            continue
        valid_category_keys.add(category_result)
        names = category_groups.setdefault(category_result, [])
        if category_entry.raw_name not in names:
            names.append(category_entry.raw_name)

    merged_categories = tuple(
        MergedCategory(key=key, names=tuple(names))
        for key, names in category_groups.items()
        if len(names) > 1
    )

    for gasto in split.gastos:
        refusal = checks.expenses.get(gasto.ref)
        if refusal is not None:
            problems.append(CellProblem(gasto.ref, "Gastos", refusal.code))
        if gasto.category is None:
            continue
        category_result = checks.category_names.get(gasto.category)
        if isinstance(category_result, Refusal):
            problems.append(CellProblem(gasto.ref, "Categoría", category_result.code))
        elif category_result is not None and category_result not in valid_category_keys:
            problems.append(CellProblem(gasto.ref, "Categoría", "import.category_outside_list"))

    # -- Customers: one check per distinct collapsed name, filed by its own field. ---
    rows_by_customer_name: dict[str, list[VentaRow]] = {}
    for venta in split.ventas:
        if venta.customer is None:
            continue
        rows_by_customer_name.setdefault(collapse_spaces(venta.customer), []).append(venta)

    mentions = customer_mentions(split, mapping)
    unused_mapping_entries = tuple(mention.name for mention in mentions if mention.ref is None)

    identity_by_name: dict[str, CustomerIdentity] = {}
    for mention in mentions:
        customer_result = checks.customers.get(mention.collapsed_name)
        if customer_result is None:
            continue
        if isinstance(customer_result, CustomerRefusal):
            if customer_result.phone_code is not None:
                assert mention.mapping_line is not None
                problems.append(
                    CellProblem(
                        SheetRef(checks.mapping_sheet, mention.mapping_line),
                        "phone",
                        customer_result.phone_code,
                    )
                )
            if customer_result.name_code is not None and mention.ref is not None:
                problems.append(CellProblem(mention.ref, "Cliente", customer_result.name_code))
            continue
        if mention.ref is not None:
            identity_by_name[mention.collapsed_name] = (
                ByPhone(customer_result.phone_key)
                if customer_result.phone_key is not None
                else ByName(mention.collapsed_name)
            )

    phone_to_names: dict[str, set[str]] = {}
    name_only: list[str] = []
    for collapsed, identity in identity_by_name.items():
        if isinstance(identity, ByPhone):
            phone_to_names.setdefault(identity.phone_key, set()).add(collapsed)
        else:
            name_only.append(collapsed)

    customers: list[PlannedCustomer] = []
    for phone_key, collapsed_names in phone_to_names.items():
        rows_for_group = [row for name in collapsed_names for row in rows_by_customer_name[name]]
        kept_row = max(rows_for_group, key=_venta_sort_key)
        assert kept_row.customer is not None
        vip = any(row.kind == "Amigo" for row in rows_for_group)
        customers.append(
            PlannedCustomer(
                kept_name=kept_row.customer,
                spellings=tuple(sorted(collapsed_names)),
                vip=vip,
                identity=ByPhone(phone_key),
            )
        )

    for collapsed in sorted(name_only):
        rows_for_group = rows_by_customer_name[collapsed]
        kept_row = max(rows_for_group, key=_venta_sort_key)
        assert kept_row.customer is not None
        vip = any(row.kind == "Amigo" for row in rows_for_group)
        customers.append(
            PlannedCustomer(
                kept_name=kept_row.customer,
                spellings=(collapsed,),
                vip=vip,
                identity=ByName(collapsed),
            )
        )

    # -- Ventas variety mentions against the Ajustes list (like every other sheet). --
    for venta in split.ventas:
        _check_variety_mention(
            venta.ref, venta.variety, "Variedad", checks.variety_names, valid_variety_keys, problems
        )

    # -- Sales: sale_inputs' own problems, owner refusals, Pendiente-without-customer,
    # -- the $0 rule, mismatches and counts. -------------------------------------------
    sale_results = sale_inputs(split.ventas, checks.variety_names)
    sale_count = 0
    payment_count = 0
    planned_sales: list[PlannedSale] = []
    for venta, sale_result in zip(split.ventas, sale_results, strict=True):
        if isinstance(sale_result, CellProblem):
            problems.append(sale_result)
            continue
        check = checks.sales.get(venta.ref)
        if check is None:
            continue
        if check.refusal is not None:
            problems.append(CellProblem(venta.ref, "Ventas", check.refusal.code))
            continue
        assert check.total is not None
        if sale_result.left_owing and not sale_result.has_customer and check.total > 0:
            problems.append(
                CellProblem(venta.ref, "Cliente", "import.pendiente_without_customer")
            )
            continue
        assert isinstance(venta.total, int)
        if venta.total != check.total:
            mismatches.append(
                Mismatch(venta.ref, sheet_total=venta.total, recomputed_total=check.total)
            )
        sale_count += 1

        # The $0 rule (sales.md): once the checked total is $0, nothing is owed and
        # there is no method, whatever the sheet's Pago column said.
        if check.total > 0:
            method = sale_result.method
            left_owing = sale_result.left_owing
        else:
            method = None
            left_owing = False
        if not left_owing and method is not None:
            payment_count += 1

        customer_identity = (
            identity_by_name.get(collapse_spaces(venta.customer))
            if venta.customer is not None
            else None
        )
        planned_sales.append(
            PlannedSale(
                ref=venta.ref,
                variety_key=sale_result.variety_key,
                customer_identity=customer_identity,
                vip=sale_result.vip,
                gift=sale_result.gift,
                method=method,
                left_owing=left_owing,
                total=check.total,
                sale_date=sale_result.sale_date,
                note=sale_result.note,
            )
        )

    customers_without_phone = sum(1 for c in customers if isinstance(c.identity, ByName))

    counts = Counts(
        varieties=len(valid_variety_keys),
        price_entries=len(split.price_history),
        catalog_attributes=len(split.catalog),
        stock_entries=len(split.entradas),
        expense_categories=len(category_groups),
        expenses=len(split.gastos),
        customers=len(customers),
        customers_without_phone=customers_without_phone,
        sales=sale_count,
        payments=payment_count,
    )

    return ImportPlan(
        problems=tuple(problems),
        unfinished=split.unfinished,
        mismatches=tuple(mismatches),
        customers=tuple(customers),
        merged_categories=merged_categories,
        unused_mapping_entries=unused_mapping_entries,
        counts=counts,
        entrada_order=tuple(sorted(split.entradas, key=_entrada_sort_key)),
        venta_order=tuple(sorted(split.ventas, key=_venta_sort_key)),
        sales=tuple(sorted(planned_sales, key=lambda sale: (sale.sale_date, sale.ref.row))),
    )
