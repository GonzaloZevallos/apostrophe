"""Runs the owner checks on finished rows and builds the `ImportPlan` (ADR-0018).

This is the one place that translates between `application/ports.py`'s shapes (what an
owner's adapter returns) and `domain/plan.py`'s mirrors of them (what the pure plan
builder takes): `domain/plan.py` never imports `application`, so every `Refusal`,
`VarietyKey`, `CustomerKey`, `SaleCheckInput` and `SaleCheck` crossing that boundary is
rebuilt here, field for field.

Eligibility (every owner's `has_records()`) runs first, before any sheet is parsed
further or any owner check runs, and refuses with `import.business_has_records` alone.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date

from app.shared.pricing_settings import PricingSettings
from app.spreadsheet_import.application import ports
from app.spreadsheet_import.domain import plan as domain_plan
from app.spreadsheet_import.domain.rows import (
    CellProblem,
    ParsedMapping,
    ParsedWorkbook,
    PriceHistoryRow,
    SheetRef,
)


def has_any_records(
    varieties: ports.VarietiesImport,
    stock: ports.StockImport,
    expenses: ports.ExpensesImport,
    customers: ports.CustomersImport,
    sales: ports.SalesImport,
    payments: ports.PaymentsImport,
) -> bool:
    """Every owner that counts towards eligibility (catalog never does: a seeded
    header, footer or attribute row doesn't count)."""
    return (
        varieties.has_records()
        or stock.has_records()
        or expenses.has_records()
        or customers.has_records()
        or sales.has_records()
        or payments.has_records()
    )


def plan_import(
    parsed: ParsedWorkbook,
    mapping: ParsedMapping,
    *,
    varieties: ports.VarietiesImport,
    stock: ports.StockImport,
    catalog: ports.CatalogImport,
    expenses: ports.ExpensesImport,
    customers: ports.CustomersImport,
    sales: ports.SalesImport,
    payments: ports.PaymentsImport,
    pricing_settings: ports.PricingSettingsImport,
    today: date,
    mapping_sheet: str,
    header_footer_ref: SheetRef,
    business_ref: SheetRef,
) -> domain_plan.ImportPlan:
    """`mapping_sheet`, `header_footer_ref` and `business_ref` all name a sheet, a
    cell or a fixed label (the plan's invariant: only `adapters/layout.py` does that),
    so `adapters/cli.py` — the only caller — passes them in from there; this module
    never imports `adapters` itself (`application/` never imports an adapter)."""
    if has_any_records(varieties, stock, expenses, customers, sales, payments):
        return _ineligible_plan(business_ref)

    split_result = domain_plan.split(parsed)

    variety_names = {
        raw: _variety_key_or_refusal(varieties.check_name(raw))
        for raw in _collect_variety_names(split_result)
    }

    thresholds = {
        row.ref: _opt_refusal(stock.check_threshold(row.threshold))
        for row in split_result.varieties
        if row.threshold is not None
    }

    price_history_rows, price_history_keys = _valid_price_history(
        split_result.price_history, variety_names
    )
    price_history_checks: dict[SheetRef, domain_plan.Refusal | None] = {}
    if price_history_rows:
        results = varieties.check_price_history(price_history_rows, price_history_keys)
        price_history_checks = {
            row.ref: _opt_refusal(result)
            for row, result in zip(price_history_rows, results, strict=True)
        }

    catalog_attributes = {
        row.ref: _opt_refusal(catalog.check_attributes(row)) for row in split_result.catalog
    }

    header_footer_refusal = catalog.check_header_footer(split_result.header_footer)
    header_footer = (
        None
        if header_footer_refusal is None
        else domain_plan.HeaderFooterCheck(
            ref=header_footer_ref, refusal=_to_domain_refusal(header_footer_refusal)
        )
    )

    category_names = _check_category_names(split_result, expenses)

    expenses_checks = {
        row.ref: _opt_refusal(expenses.check_expense(row, today)) for row in split_result.gastos
    }

    entradas_checks = {
        row.ref: _opt_refusal(stock.check_entry(row, today)) for row in split_result.entradas
    }

    customer_checks = {
        mention.collapsed_name: _customer_check_result(
            customers.check_customer(mention.name, mention.phone)
        )
        for mention in domain_plan.customer_mentions(split_result, mapping)
    }

    # The switches rows are priced with come from the sheet alone, never from the
    # stored ones (docs/adr/0031); the stored ones are read once, to tell what to turn on.
    needs = domain_plan.needed_settings(split_result)
    sales_checks = _check_sales(
        split_result, variety_names, price_history_keys, sales, today, needs
    )

    checks = domain_plan.Checks(
        variety_names=variety_names,
        thresholds=thresholds,
        price_history=price_history_checks,
        catalog_attributes=catalog_attributes,
        header_footer=header_footer,
        category_names=category_names,
        expenses=expenses_checks,
        entradas=entradas_checks,
        customers=customer_checks,
        sales=sales_checks,
        mapping_sheet=mapping_sheet,
        stored_settings=pricing_settings.current(),
    )
    return domain_plan.build_plan(split_result, mapping, checks)


# -- Eligibility's own trivial plan: no sheet was read, nothing else to report. -------


def _ineligible_plan(business_ref: SheetRef) -> domain_plan.ImportPlan:
    problem = CellProblem(business_ref, business_ref.sheet, "import.business_has_records")
    return domain_plan.ImportPlan(
        problems=(problem,),
        unfinished=(),
        mismatches=(),
        customers=(),
        merged_categories=(),
        unused_mapping_entries=(),
        counts=domain_plan.Counts(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        entrada_order=(),
        venta_order=(),
        sales=(),
    )


# -- Translating application/ports.py results into domain/plan.py's mirrors. ---------


def _to_domain_refusal(refusal: ports.Refusal) -> domain_plan.Refusal:
    return domain_plan.Refusal(code=refusal.code)


def _opt_refusal(refusal: ports.Refusal | None) -> domain_plan.Refusal | None:
    return None if refusal is None else _to_domain_refusal(refusal)


def _variety_key_or_refusal(
    result: ports.VarietyKey | ports.Refusal,
) -> domain_plan.VarietyKey | domain_plan.Refusal:
    if isinstance(result, ports.Refusal):
        return _to_domain_refusal(result)
    return domain_plan.VarietyKey(key=result.key, name=result.name)


def _customer_check_result(
    result: ports.CustomerKey | ports.CustomerRefusals,
) -> domain_plan.CustomerKey | domain_plan.CustomerRefusal:
    """A straight field-for-field mirror: `build_plan` files `name_code` and
    `phone_code` independently, each at its own site, so both reach the report when
    both are broken (ADR-0021: the import never reads a customer code string to
    decide where it goes)."""
    if isinstance(result, ports.CustomerRefusals):
        return domain_plan.CustomerRefusal(name_code=result.name_code, phone_code=result.phone_code)
    return domain_plan.CustomerKey(phone_key=result.phone_key)


def _to_port_sale_input(sale_input: domain_plan.SaleCheckInput) -> ports.SaleCheckInput:
    return ports.SaleCheckInput(
        variety_key=sale_input.variety_key,
        grams=sale_input.grams,
        has_customer=sale_input.has_customer,
        vip=sale_input.vip,
        gift=sale_input.gift,
        special_total=sale_input.special_total,
        shipping=sale_input.shipping,
        method=sale_input.method,
        left_owing=sale_input.left_owing,
        sale_date=sale_input.sale_date,
        note=sale_input.note,
    )


# -- Gathering what every owner needs to be asked. ------------------------------------


def _collect_variety_names(split_result: domain_plan.Split) -> set[str]:
    names: set[str] = {row.raw_name for row in split_result.varieties}
    names |= {row.variety for row in split_result.price_history if row.variety}
    names |= {row.variety for row in split_result.catalog if row.variety}
    names |= {row.variety for row in split_result.entradas if row.variety}
    names |= {row.variety for row in split_result.ventas if row.variety}
    return names


def _valid_price_history(
    rows: Sequence[PriceHistoryRow],
    variety_names: Mapping[str, domain_plan.VarietyKey | domain_plan.Refusal],
) -> tuple[list[PriceHistoryRow], dict[str, str]]:
    """Only rows whose variety text is itself a well-formed name (varieties.md's own
    rule) are handed to `check_price_history`: an unknown-but-well-formed variety is
    reported by `build_plan`'s own cross-check against Ajustes 7-16, not here."""
    valid_rows: list[PriceHistoryRow] = []
    keys: dict[str, str] = {}
    for row in rows:
        result = variety_names.get(row.variety)
        if isinstance(result, domain_plan.VarietyKey):
            valid_rows.append(row)
            keys[row.variety] = result.key
    return valid_rows, keys


def _check_category_names(
    split_result: domain_plan.Split, expenses: ports.ExpensesImport
) -> dict[str, str | domain_plan.Refusal]:
    raws: set[str] = {row.raw_name for row in split_result.categories}
    raws |= {row.category for row in split_result.gastos if row.category is not None}
    result: dict[str, str | domain_plan.Refusal] = {}
    for raw in raws:
        key_or_refusal = expenses.category_key(raw)
        result[raw] = (
            _to_domain_refusal(key_or_refusal)
            if isinstance(key_or_refusal, ports.Refusal)
            else key_or_refusal
        )
    return result


def _check_sales(
    split_result: domain_plan.Split,
    variety_names: Mapping[str, domain_plan.VarietyKey | domain_plan.Refusal],
    price_history_keys: Mapping[str, str],
    sales: ports.SalesImport,
    today: date,
    settings: PricingSettings,
) -> dict[SheetRef, domain_plan.SaleCheck]:
    sale_results = domain_plan.sale_inputs(split_result.ventas, variety_names)
    pairs = [
        (venta.ref, result)
        for venta, result in zip(split_result.ventas, sale_results, strict=True)
        if isinstance(result, domain_plan.SaleCheckInput)
    ]
    if not pairs:
        return {}
    price_history_rows, _ = _valid_price_history(split_result.price_history, variety_names)
    port_inputs = [_to_port_sale_input(sale_input) for _, sale_input in pairs]
    results = sales.check_sales(
        price_history_rows, price_history_keys, port_inputs, today, settings
    )
    return {
        ref: domain_plan.SaleCheck(total=result.total, refusal=_opt_refusal(result.refusal))
        for (ref, _), result in zip(pairs, results, strict=True)
    }
