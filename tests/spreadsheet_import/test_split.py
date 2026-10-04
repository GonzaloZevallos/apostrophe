"""`domain/plan.py`'s `split`: which Entradas, Gastos and Ventas rows are unfinished,
decided before any owner check runs (the plan's invariant). Pure unit tests, no
infrastructure (CODING_STANDARDS.md section 5).
"""

from __future__ import annotations

from app.spreadsheet_import.domain.plan import split
from tests.spreadsheet_import.factories import entrada_row, gasto_row, venta_row, workbook


def test_a_finished_venta_row_is_kept() -> None:
    row = venta_row(2, total=1000)
    result = split(workbook(ventas=(row,)))

    assert result.ventas == (row,)
    assert result.unfinished == ()


def test_a_venta_row_with_text_total_is_left_out_and_listed_with_that_text() -> None:
    row = venta_row(2, total="Falta pago")
    result = split(workbook(ventas=(row,)))

    assert result.ventas == ()
    assert len(result.unfinished) == 1
    unfinished = result.unfinished[0]
    assert unfinished.ref == row.ref
    assert unfinished.sheet == "Ventas"
    assert unfinished.text == "Falta pago"


def test_a_venta_row_whose_total_has_no_saved_value_blocks() -> None:
    row = venta_row(2, total=None)
    result = split(workbook(ventas=(row,)))

    assert result.ventas == ()
    assert result.unfinished == ()
    assert len(result.problems) == 1
    problem = result.problems[0]
    assert problem.ref == row.ref
    assert problem.kind == "import.total_not_recalculated"


def test_an_entrada_row_with_blank_revisar_is_finished() -> None:
    row = entrada_row(2, revisar=None)
    result = split(workbook(entradas=(row,)))

    assert result.entradas == (row,)
    assert result.unfinished == ()


def test_an_entrada_row_with_text_revisar_is_left_out_and_listed() -> None:
    row = entrada_row(2, revisar="Falta costo")
    result = split(workbook(entradas=(row,)))

    assert result.entradas == ()
    unfinished = result.unfinished[0]
    assert unfinished.ref == row.ref
    assert unfinished.sheet == "Entradas"
    assert unfinished.text == "Falta costo"


def test_a_gasto_row_with_text_revisar_is_left_out_and_listed() -> None:
    row = gasto_row(2, revisar="Falta categoría")
    result = split(workbook(gastos=(row,)))

    assert result.gastos == ()
    unfinished = result.unfinished[0]
    assert unfinished.ref == row.ref
    assert unfinished.sheet == "Gastos"
    assert unfinished.text == "Falta categoría"
