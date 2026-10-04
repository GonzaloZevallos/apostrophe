"""`domain/plan.py`'s `build_plan`: every rule this import's domain owns, collected in
one pass, over `split` rows, the mapping file and check results built by hand
(CODING_STANDARDS.md section 5). The plan is writable only with zero problems — the
enforcement artefact this subtask adds, so every accepting case here is paired with a
rejecting one.
"""

from __future__ import annotations

from datetime import date

from app.shared.grams import Grams
from app.spreadsheet_import.domain.plan import (
    Checks,
    CustomerKey,
    HeaderFooterCheck,
    Refusal,
    SaleCheck,
    Split,
    VarietyKey,
    build_plan,
)
from app.spreadsheet_import.domain.plan import split as split_workbook
from app.spreadsheet_import.domain.rows import (
    CatalogRow,
    CategoryRow,
    EntradaRow,
    GastoRow,
    HeaderFooterCells,
    MappingEntry,
    PriceHistoryRow,
    SheetRef,
    VarietyRow,
    VentaRow,
)
from tests.spreadsheet_import.factories import (
    EMPTY_HEADER_FOOTER,
    catalog_row,
    category_row,
    entrada_row,
    gasto_row,
    mapping,
    price_row,
    variety_row,
    venta_row,
    workbook,
)

VARIEDAD_A = VarietyKey(key="variedad a", name="Variedad A")
VARIEDAD_B = VarietyKey(key="variedad b", name="Variedad B")


def _split(
    *,
    varieties: tuple[VarietyRow, ...] = (),
    price_history: tuple[PriceHistoryRow, ...] = (),
    catalog: tuple[CatalogRow, ...] = (),
    header_footer: HeaderFooterCells = EMPTY_HEADER_FOOTER,
    categories: tuple[CategoryRow, ...] = (),
    entradas: tuple[EntradaRow, ...] = (),
    gastos: tuple[GastoRow, ...] = (),
    ventas: tuple[VentaRow, ...] = (),
) -> Split:
    return split_workbook(
        workbook(
            varieties=varieties,
            price_history=price_history,
            catalog=catalog,
            header_footer=header_footer,
            categories=categories,
            entradas=entradas,
            gastos=gastos,
            ventas=ventas,
        )
    )


def _ok_sale(ref: SheetRef, total: int) -> SaleCheck:
    return SaleCheck(total=total, refusal=None)


# -- Unknown and duplicate varieties --------------------------------------------------


def test_a_variety_named_in_catalog_but_not_in_ajustes_blocks() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        catalog=(catalog_row(6, "Variedad B"),),
    )
    checks = Checks(variety_names={"Variedad A": VARIEDAD_A, "Variedad B": VARIEDAD_B})

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "import.unknown_variety" for p in plan.problems)


def test_two_ajustes_rows_with_the_same_variety_name_block() -> None:
    split = _split(varieties=(variety_row(7, "Variedad A"), variety_row(8, "variedad  a")))
    checks = Checks(variety_names={"Variedad A": VARIEDAD_A, "variedad  a": VARIEDAD_A})

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "import.duplicate_variety" for p in plan.problems)


def test_a_consistent_variety_list_has_no_variety_problem() -> None:
    split = _split(varieties=(variety_row(7, "Variedad A"),))
    checks = Checks(variety_names={"Variedad A": VARIEDAD_A})

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()


# -- Categories outside A21:A28 --------------------------------------------------------


def test_an_expense_under_a_category_outside_the_list_blocks() -> None:
    split = _split(
        categories=(category_row(21, "Insumos"),),
        gastos=(gasto_row(2, category="Fletes"),),
    )
    checks = Checks(
        category_names={"Insumos": "insumos", "Fletes": "fletes"},
        expenses={SheetRef("Gastos", 2): None},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "import.category_outside_list" for p in plan.problems)


def test_an_expense_under_a_listed_category_is_fine() -> None:
    split = _split(
        categories=(category_row(21, "Insumos"),),
        gastos=(gasto_row(2, category="Insumos"),),
    )
    checks = Checks(
        category_names={"Insumos": "insumos"}, expenses={SheetRef("Gastos", 2): None}
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()


def test_two_ajustes_category_names_that_match_are_merged_and_reported() -> None:
    split = _split(categories=(category_row(21, "Insumos"), category_row(22, "insumos")))
    checks = Checks(category_names={"Insumos": "insumos", "insumos": "insumos"})

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    [merged] = plan.merged_categories
    assert merged.key == "insumos"
    assert set(merged.names) == {"Insumos", "insumos"}


# -- Every refusal answered by the owner checks (the enforcement artefact) ------------


def test_an_owner_refusal_on_a_price_history_row_blocks_with_its_code() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        price_history=(price_row(37, "Variedad A", date(2026, 1, 1), 1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        price_history={SheetRef("Ajustes", 37): Refusal("varieties.bulk_not_below_list")},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "varieties.bulk_not_below_list" for p in plan.problems)


def test_no_owner_refusal_means_no_problem_for_that_row() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        price_history=(price_row(37, "Variedad A", date(2026, 1, 1), 1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        price_history={SheetRef("Ajustes", 37): None},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()


# -- Customers missing from the mapping ------------------------------------------------


def test_a_customer_name_missing_from_the_mapping_blocks() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, customer="Juana", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "import.customer_not_in_mapping" for p in plan.problems)


def test_a_customer_name_present_in_the_mapping_is_fine() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, customer="Juana", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        customers={"Juana": CustomerKey("549111")},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    entries = (MappingEntry(2, "Juana", "+54 9 11 1111-1111"),)
    plan = build_plan(split, mapping(entries=entries), checks)

    assert plan.problems == ()
    assert len(plan.customers) == 1
    assert plan.customers[0].kept_name == "Juana"


# -- Pendiente with no customer ---------------------------------------------------------


def test_pendiente_with_no_customer_and_a_total_above_zero_blocks() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, payment="Pendiente", customer=None, total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "import.pendiente_without_customer" for p in plan.problems)


def test_pendiente_with_no_customer_and_a_zero_total_does_not_block() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, kind="Regalo", payment="Pendiente", customer=None, total=0),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 0)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    assert plan.counts.sales == 1
    assert plan.counts.payments == 0


# -- Unfinished rows never block, and are listed exactly once -------------------------


def test_falta_costo_gramos_negativos_and_sin_precio_are_listed_once_and_never_block() -> None:
    split = _split(
        entradas=(
            entrada_row(2, revisar="Falta costo"),
            entrada_row(3, revisar="Gramos negativos"),
        ),
        ventas=(venta_row(4, total="Sin precio"),),
    )
    checks = Checks()

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    texts = {u.text for u in plan.unfinished}
    assert texts == {"Falta costo", "Gramos negativos", "Sin precio"}
    assert len(plan.unfinished) == 3


# -- A name, an Amigo or a spelling found only on unfinished rows ---------------------


def test_a_name_found_only_on_an_unfinished_row_creates_no_customer_and_is_unused() -> None:
    split = _split(
        entradas=(),
        ventas=(venta_row(2, customer="Juana", total="Falta pago"),),
    )
    checks = Checks(customers={"Juana": CustomerKey("549111")})

    entries = (MappingEntry(2, "Juana", "+54 9 11 1111-1111"),)
    plan = build_plan(split, mapping(entries=entries), checks)

    assert plan.problems == ()
    assert plan.customers == ()
    assert plan.unused_mapping_entries == ("Juana",)


def test_an_amigo_row_that_is_unfinished_does_not_make_its_customer_vip() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(
            venta_row(2, customer="Juana", kind="Lista", payment="Efectivo", total=1000),
            venta_row(3, customer="Juana", kind="Amigo", total="Falta pago"),
        ),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        customers={"Juana": CustomerKey("549111")},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(
        split, mapping(entries=(MappingEntry(2, "Juana", "+54 9 11 1111-1111"),)), checks
    )

    assert plan.problems == ()
    [customer] = plan.customers
    assert customer.vip is False


def test_a_finished_amigo_row_makes_its_customer_vip() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, customer="Juana", kind="Amigo", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        customers={"Juana": CustomerKey("549111")},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(
        split, mapping(entries=(MappingEntry(2, "Juana", "+54 9 11 1111-1111"),)), checks
    )

    assert plan.problems == ()
    [customer] = plan.customers
    assert customer.vip is True


def test_a_spelling_found_only_on_an_unfinished_row_is_not_merged_or_kept() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(
            venta_row(2, customer="Juana Perez", kind="Lista", payment="Efectivo", total=1000),
            venta_row(3, customer="J Perez", total="Falta pago"),
        ),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        customers={"Juana Perez": CustomerKey("549111"), "J Perez": CustomerKey("549111")},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(
        split,
        mapping(
            entries=(
                MappingEntry(2, "Juana Perez", "+54 9 11 1111-1111"),
                MappingEntry(3, "J Perez", "+54 9 11 1111-1111"),
            )
        ),
        checks,
    )

    assert plan.problems == ()
    [customer] = plan.customers
    assert customer.kept_name == "Juana Perez"
    assert customer.spellings == ("Juana Perez",)
    assert plan.unused_mapping_entries == ("J Perez",)


# -- The kept spelling and its tie ------------------------------------------------------


def test_the_kept_spelling_is_the_most_recent_finished_row() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(
            venta_row(
                2, customer="Juana", payment="Efectivo", total=1000, sale_date=date(2026, 1, 1)
            ),
            venta_row(
                3, customer="J. Perez", payment="Efectivo", total=1000, sale_date=date(2026, 1, 5)
            ),
        ),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        customers={"Juana": CustomerKey("549111"), "J. Perez": CustomerKey("549111")},
        sales={
            SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000),
            SheetRef("Ventas", 3): _ok_sale(SheetRef("Ventas", 3), 1000),
        },
    )

    plan = build_plan(
        split,
        mapping(
            entries=(
                MappingEntry(2, "Juana", "+54 9 11 1111-1111"),
                MappingEntry(3, "J. Perez", "+54 9 11 1111-1111"),
            )
        ),
        checks,
    )

    [customer] = plan.customers
    assert customer.kept_name == "J. Perez"


def test_on_a_same_date_tie_the_lowest_sheet_row_wins() -> None:
    same_date = date(2026, 1, 1)
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(
            venta_row(2, customer="Juana", payment="Efectivo", total=1000, sale_date=same_date),
            venta_row(3, customer="J. Perez", payment="Efectivo", total=1000, sale_date=same_date),
        ),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        customers={"Juana": CustomerKey("549111"), "J. Perez": CustomerKey("549111")},
        sales={
            SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000),
            SheetRef("Ventas", 3): _ok_sale(SheetRef("Ventas", 3), 1000),
        },
    )

    plan = build_plan(
        split,
        mapping(
            entries=(
                MappingEntry(2, "Juana", "+54 9 11 1111-1111"),
                MappingEntry(3, "J. Perez", "+54 9 11 1111-1111"),
            )
        ),
        checks,
    )

    [customer] = plan.customers
    assert customer.kept_name == "J. Perez"


# -- Mismatches, including a Regalo with shipping --------------------------------------


def test_a_mismatched_total_is_reported_and_never_blocks() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, payment="Efectivo", total=900),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    [mismatch] = plan.mismatches
    assert mismatch.sheet_total == 900
    assert mismatch.recomputed_total == 1000


def test_a_regalo_with_shipping_mismatch_is_reported() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, kind="Regalo", shipping=500, total=400),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 500)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    [mismatch] = plan.mismatches
    assert mismatch.sheet_total == 400
    assert mismatch.recomputed_total == 500


def test_a_matching_total_is_not_a_mismatch() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, payment="Efectivo", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.mismatches == ()


# -- Stable write order: date, then sheet row ------------------------------------------


def test_entradas_and_ventas_sort_by_date_then_sheet_row_even_when_unsorted() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        entradas=(
            entrada_row(5, entry_date=date(2026, 1, 1)),
            entrada_row(2, entry_date=date(2025, 12, 31)),
            entrada_row(3, entry_date=date(2025, 12, 31)),
        ),
        ventas=(
            venta_row(9, payment="Efectivo", total=1000, sale_date=date(2026, 1, 2)),
            venta_row(4, payment="Efectivo", total=1000, sale_date=date(2026, 1, 1)),
            venta_row(6, payment="Efectivo", total=1000, sale_date=date(2026, 1, 1)),
        ),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={
            SheetRef("Ventas", 9): _ok_sale(SheetRef("Ventas", 9), 1000),
            SheetRef("Ventas", 4): _ok_sale(SheetRef("Ventas", 4), 1000),
            SheetRef("Ventas", 6): _ok_sale(SheetRef("Ventas", 6), 1000),
        },
    )

    plan = build_plan(split, mapping(), checks)

    assert [row.ref.row for row in plan.entrada_order] == [2, 3, 5]
    assert [row.ref.row for row in plan.venta_order] == [4, 6, 9]


# -- Counts -------------------------------------------------------------------------


def test_counts_cover_every_kind_of_record() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        price_history=(price_row(37, "Variedad A", date(2026, 1, 1), 1000),),
        entradas=(entrada_row(2),),
        categories=(category_row(21, "Insumos"),),
        gastos=(gasto_row(2, category="Insumos"),),
        ventas=(venta_row(2, payment="Efectivo", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        price_history={SheetRef("Ajustes", 37): None},
        category_names={"Insumos": "insumos"},
        expenses={SheetRef("Gastos", 2): None},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    assert plan.counts.varieties == 1
    assert plan.counts.price_entries == 1
    assert plan.counts.stock_entries == 1
    assert plan.counts.expense_categories == 1
    assert plan.counts.expenses == 1
    assert plan.counts.sales == 1
    assert plan.counts.payments == 1


# -- A Ventas row's variety must also match the Ajustes list ---------------------------


def test_a_ventas_row_naming_a_well_formed_but_unknown_variety_blocks() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, variety="Variedad B", payment="Efectivo", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A, "Variedad B": VARIEDAD_B},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "import.unknown_variety" for p in plan.problems)


# -- The $0 rule: no method and nothing owed once the checked total is $0 -------------


def test_a_zero_total_efectivo_row_ends_up_with_no_method_and_nothing_owed() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, kind="Regalo", payment="Efectivo", total=0),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 0)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    [sale] = plan.sales
    assert sale.method is None
    assert sale.left_owing is False
    assert plan.counts.payments == 0


def test_a_zero_total_pendiente_row_ends_up_with_no_method_and_nothing_owed() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, kind="Regalo", payment="Pendiente", customer=None, total=0),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 0)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    [sale] = plan.sales
    assert sale.method is None
    assert sale.left_owing is False


def test_a_nonzero_total_keeps_its_method_and_owing() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, payment="Efectivo", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 1000)},
    )

    plan = build_plan(split, mapping(), checks)

    [sale] = plan.sales
    assert sale.method == "Efectivo"
    assert sale.left_owing is False
    assert plan.counts.payments == 1


# -- A finished $0 Regalo row with a blank Pago never blocks --------------------------


def test_a_regalo_row_with_a_blank_payment_does_not_block() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, kind="Regalo", payment=None, customer=None, total=0),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={SheetRef("Ventas", 2): _ok_sale(SheetRef("Ventas", 2), 0)},
    )

    plan = build_plan(split, mapping(), checks)

    assert plan.problems == ()
    assert plan.counts.sales == 1
    assert plan.counts.payments == 0


# -- Owner-named refs reach the header/footer refusal, never invented by domain ------


def test_a_header_footer_refusal_blocks_with_the_caller_given_ref() -> None:
    split = _split()
    ref = SheetRef("Catálogo", 18)
    checks = Checks(
        header_footer=HeaderFooterCheck(ref=ref, refusal=Refusal("catalog.text_too_long"))
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    [problem] = plan.problems
    assert problem.ref == ref
    assert problem.kind == "catalog.text_too_long"


def test_a_mapping_phone_refusal_uses_the_caller_given_mapping_sheet_label() -> None:
    split = _split()
    checks = Checks(
        customers={"Juana": Refusal("customers.phone_invalid")}, mapping_sheet="Mapeo"
    )

    plan = build_plan(
        split, mapping(entries=(MappingEntry(5, "Juana", "123"),)), checks
    )

    assert not plan.writable
    [problem] = plan.problems
    assert problem.ref == SheetRef("Mapeo", 5)
    assert problem.kind == "customers.phone_invalid"


# -- Every other owner refusal build_plan surfaces --------------------------------------


def test_a_threshold_refusal_blocks_with_its_code() -> None:
    split = _split(varieties=(variety_row(7, "Variedad A", threshold=Grams.of("-1")),))
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        thresholds={SheetRef("Ajustes", 7): Refusal("stock.threshold_not_positive")},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "stock.threshold_not_positive" for p in plan.problems)


def test_a_catalog_attributes_refusal_blocks_with_its_code() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        catalog=(catalog_row(6, "Variedad A", shown="Tal vez"),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        catalog_attributes={SheetRef("Catálogo", 6): Refusal("catalog.shown_unknown")},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "catalog.shown_unknown" for p in plan.problems)


def test_an_entrada_refusal_blocks_with_its_code() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        entradas=(entrada_row(2, variety="Variedad A"),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        entradas={SheetRef("Entradas", 2): Refusal("stock.cost_missing")},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "stock.cost_missing" for p in plan.problems)


def test_an_expense_refusal_blocks_with_its_code() -> None:
    split = _split(
        categories=(category_row(21, "Insumos"),),
        gastos=(gasto_row(2, category="Insumos"),),
    )
    checks = Checks(
        category_names={"Insumos": "insumos"},
        expenses={SheetRef("Gastos", 2): Refusal("expenses.amount_not_positive")},
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "expenses.amount_not_positive" for p in plan.problems)


def test_a_sale_refusal_blocks_with_its_code() -> None:
    split = _split(
        varieties=(variety_row(7, "Variedad A"),),
        ventas=(venta_row(2, payment="Efectivo", total=1000),),
    )
    checks = Checks(
        variety_names={"Variedad A": VARIEDAD_A},
        sales={
            SheetRef("Ventas", 2): SaleCheck(total=None, refusal=Refusal("sale.no_price_that_day"))
        },
    )

    plan = build_plan(split, mapping(), checks)

    assert not plan.writable
    assert any(p.kind == "sale.no_price_that_day" for p in plan.problems)
