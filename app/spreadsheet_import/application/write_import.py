"""Writes a writable `ImportPlan` into one business, in the fixed order the plan sets
(ADR-0018; the plan's invariant on write order and `recorded_at`).

Runs only on a writable plan, and checks eligibility again first: the first check, in
`plan_import.py`, and this one, bracket the whole run so a record written by someone
else between the two still stops it (the plan's known risk on concurrent writes is
about what happens *during* the write, not this race, which this second check closes).

Every writer gets `NoCommit` (`app/spreadsheet_import/application/no_commit.py`):
nothing here ever commits; only `adapters/cli.py` commits the real session, once, at
the end of a real run.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.spreadsheet_import.application import ports
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.plan_import import PROVISIONAL_SETTINGS, has_any_records
from app.spreadsheet_import.domain.plan import (
    ByPhone,
    CustomerIdentity,
    ImportPlan,
    PlannedCustomer,
    PlannedSale,
    split,
)
from app.spreadsheet_import.domain.rows import (
    CatalogRow,
    CategoryRow,
    GastoRow,
    ParsedWorkbook,
    SheetRef,
    VarietyRow,
    VentaRow,
)


class WriteImportRefused(Exception):
    """Carries the refusal's own fixed code (the plan's invariant: `refused: <code>`
    alone ever reaches the terminal)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class _RecordedAtSequence:
    """`import_instant + n µs`, `n` from one counter over Entradas, Gastos and Ventas
    together (the plan's invariant)."""

    def __init__(self, start: datetime) -> None:
        self._start = start
        self._n = 0

    def next(self) -> datetime:
        instant = self._start + timedelta(microseconds=self._n)
        self._n += 1
        return instant


def write_import(
    plan: ImportPlan,
    parsed: ParsedWorkbook,
    *,
    varieties: ports.VarietiesImport,
    stock: ports.StockImport,
    catalog: ports.CatalogImport,
    expenses: ports.ExpensesImport,
    customers: ports.CustomersImport,
    sales: ports.SalesImport,
    payments: ports.PaymentsImport,
    import_instant: datetime,
    today: date,
) -> None:
    if not plan.writable:
        raise WriteImportRefused("import.plan_not_writable")
    if has_any_records(varieties, stock, expenses, customers, sales, payments):
        raise WriteImportRefused("import.business_has_records")

    split_result = split(parsed)
    transaction = NoCommit()
    recorded_at = _RecordedAtSequence(import_instant)

    variety_ids = _write_varieties(split_result.varieties, varieties, transaction)
    for price_row in split_result.price_history:
        variety_id = variety_ids[_variety_key(price_row.variety, varieties)]
        varieties.write_price_entry(variety_id, price_row, transaction)
    _write_thresholds(split_result.varieties, variety_ids, varieties, stock, transaction)
    _write_catalog(split_result.catalog, variety_ids, varieties, catalog, today, transaction)
    catalog.write_header_footer(split_result.header_footer, today, transaction)
    category_ids = _write_categories(split_result.categories, expenses, transaction)

    customer_ids = _write_customers(plan.customers, customers, transaction)

    for entrada_row in plan.entrada_order:
        variety_id = variety_ids[_variety_key(entrada_row.variety, varieties)]
        stock.write_entry(variety_id, entrada_row, recorded_at.next(), today, transaction)

    for gasto_row in sorted(split_result.gastos, key=_gasto_sort_key):
        category_id = category_ids[_category_key(gasto_row.category, expenses)]
        expenses.write_expense(category_id, gasto_row, recorded_at.next(), today, transaction)

    ventas_by_ref: dict[SheetRef, VentaRow] = {row.ref: row for row in split_result.ventas}
    for planned in plan.sales:
        _write_sale(
            planned,
            ventas_by_ref,
            variety_ids,
            customer_ids,
            sales,
            recorded_at,
            today,
            transaction,
        )


def _variety_key(raw: str | None, varieties: ports.VarietiesImport) -> str:
    assert raw is not None, "write_import takes only a writable plan"
    result = varieties.check_name(raw)
    assert isinstance(result, ports.VarietyKey), "write_import takes only a writable plan"
    return result.key


def _category_key(raw: str | None, expenses: ports.ExpensesImport) -> str:
    assert raw is not None, "write_import takes only a writable plan"
    result = expenses.category_key(raw)
    assert isinstance(result, str), "write_import takes only a writable plan"
    return result


def _gasto_sort_key(row: GastoRow) -> tuple[date, int]:
    assert row.spent_on is not None
    return (row.spent_on, row.ref.row)


def _write_varieties(
    rows: tuple[VarietyRow, ...], varieties: ports.VarietiesImport, transaction: NoCommit
) -> dict[str, int]:
    ids: dict[str, int] = {}
    for row in rows:
        result = varieties.check_name(row.raw_name)
        assert isinstance(result, ports.VarietyKey), "write_import takes only a writable plan"
        if result.key in ids:
            continue
        ids[result.key] = varieties.write_variety(result.name, transaction)
    return ids


def _write_thresholds(
    rows: tuple[VarietyRow, ...],
    variety_ids: dict[str, int],
    varieties: ports.VarietiesImport,
    stock: ports.StockImport,
    transaction: NoCommit,
) -> None:
    for row in rows:
        if row.threshold is None:
            continue
        variety_id = variety_ids[_variety_key(row.raw_name, varieties)]
        stock.write_threshold(variety_id, row.threshold, transaction)


def _write_catalog(
    rows: tuple[CatalogRow, ...],
    variety_ids: dict[str, int],
    varieties: ports.VarietiesImport,
    catalog: ports.CatalogImport,
    today: date,
    transaction: NoCommit,
) -> None:
    for row in rows:
        variety_id = variety_ids[_variety_key(row.variety, varieties)]
        catalog.write_attributes(variety_id, row, today, transaction)


def _write_categories(
    rows: tuple[CategoryRow, ...], expenses: ports.ExpensesImport, transaction: NoCommit
) -> dict[str, int]:
    ids: dict[str, int] = {}
    for row in rows:
        key = _category_key(row.raw_name, expenses)
        ids[key] = expenses.write_category(row.raw_name, transaction)
    return ids


def _write_customers(
    customers_plan: tuple[PlannedCustomer, ...],
    customers: ports.CustomersImport,
    transaction: NoCommit,
) -> dict[CustomerIdentity, int]:
    ids: dict[CustomerIdentity, int] = {}
    for planned in customers_plan:
        phone_key = planned.identity.phone_key if isinstance(planned.identity, ByPhone) else None
        ids[planned.identity] = customers.write_customer(
            planned.kept_name, phone_key, planned.vip, transaction
        )
    return ids


def _write_sale(
    planned: PlannedSale,
    ventas_by_ref: dict[SheetRef, VentaRow],
    variety_ids: dict[str, int],
    customer_ids: dict[CustomerIdentity, int],
    sales: ports.SalesImport,
    recorded_at: _RecordedAtSequence,
    today: date,
    transaction: NoCommit,
) -> None:
    row = ventas_by_ref[planned.ref]
    assert row.grams is not None, "write_import takes only a writable plan"
    sale_input = ports.SaleCheckInput(
        variety_key=planned.variety_key,
        grams=row.grams,
        has_customer=planned.customer_identity is not None,
        vip=planned.vip,
        gift=planned.gift,
        special_total=row.special_total,
        shipping=row.shipping if row.shipping is not None else 0,
        method=planned.method,
        left_owing=planned.left_owing,
        sale_date=planned.sale_date,
        note=planned.note,
    )
    customer_id = (
        customer_ids[planned.customer_identity] if planned.customer_identity is not None else None
    )
    variety_id = variety_ids[planned.variety_key]
    sales.write_sale(
        variety_id,
        customer_id,
        sale_input,
        recorded_at.next(),
        today,
        transaction,
        PROVISIONAL_SETTINGS,
    )
