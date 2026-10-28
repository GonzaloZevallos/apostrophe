"""`domain/plan.py`'s `sale_inputs`: turns each finished Ventas row into what sales'
port needs, or the problem that blocks it before any owner is asked. Pure unit tests,
check results built by hand (CODING_STANDARDS.md section 5).
"""

from __future__ import annotations

from app.shared.quantity import Quantity
from app.spreadsheet_import.domain.plan import VarietyKey, sale_inputs
from app.spreadsheet_import.domain.rows import CellProblem
from tests.spreadsheet_import.factories import venta_row

VARIETY_NAMES = {"Variedad A": VarietyKey(key="variedad a", name="Variedad A")}


def test_pendiente_is_left_owing_with_no_method() -> None:
    row = venta_row(2, payment="Pendiente", customer="Juana")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert not isinstance(result, CellProblem)
    assert result.left_owing is True
    assert result.method is None


def test_efectivo_and_transferencia_are_on_the_spot_methods() -> None:
    efectivo, transferencia = sale_inputs(
        (venta_row(2, payment="Efectivo"), venta_row(3, payment="Transferencia")), VARIETY_NAMES
    )

    assert not isinstance(efectivo, CellProblem)
    assert efectivo.left_owing is False
    assert efectivo.method == "cash"
    assert not isinstance(transferencia, CellProblem)
    assert transferencia.left_owing is False
    assert transferencia.method == "transfer"


def test_a_blank_pago_is_not_owing_and_has_no_method() -> None:
    row = venta_row(2, payment=None, kind="Regalo")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert not isinstance(result, CellProblem)
    assert result.left_owing is False
    assert result.method is None


def test_an_unknown_payment_value_is_the_problem_import_payment_unknown() -> None:
    row = venta_row(2, payment="Cheque")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert isinstance(result, CellProblem)
    assert result.ref == row.ref
    assert result.kind == "import.payment_unknown"


def test_amigo_is_vip_and_never_a_gift() -> None:
    row = venta_row(2, kind="Amigo", customer="Juana")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert not isinstance(result, CellProblem)
    assert result.vip is True
    assert result.gift is False


def test_regalo_is_a_gift_never_vip() -> None:
    row = venta_row(2, kind="Regalo")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert not isinstance(result, CellProblem)
    assert result.gift is True
    assert result.vip is False


def test_blank_and_lista_kind_are_neither_vip_nor_gift() -> None:
    blank, lista = sale_inputs((venta_row(2, kind=""), venta_row(3, kind="Lista")), VARIETY_NAMES)

    for result in (blank, lista):
        assert not isinstance(result, CellProblem)
        assert result.vip is False
        assert result.gift is False


def test_an_unknown_kind_value_is_the_problem_import_kind_unknown() -> None:
    row = venta_row(2, kind="Mayorista")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert isinstance(result, CellProblem)
    assert result.kind == "import.kind_unknown"


def test_a_special_total_on_a_regalo_row_blocks() -> None:
    row = venta_row(2, kind="Regalo", special_total=5000)
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert isinstance(result, CellProblem)
    assert result.ref == row.ref
    assert result.kind == "import.gift_with_special_total"


def test_amigo_with_no_customer_blocks() -> None:
    row = venta_row(2, kind="Amigo", customer=None)
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert isinstance(result, CellProblem)
    assert result.kind == "import.amigo_without_customer"


def test_an_unknown_variety_blocks_before_payment_or_kind_are_read() -> None:
    row = venta_row(2, variety="No existe", payment="Cheque", kind="Mayorista")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert isinstance(result, CellProblem)
    assert result.kind == "import.unknown_variety"


def test_a_blank_shipping_cell_becomes_zero() -> None:
    row = venta_row(2, shipping=None)
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert not isinstance(result, CellProblem)
    assert result.shipping == 0


def test_has_customer_reflects_a_non_blank_customer_cell() -> None:
    with_customer, without = sale_inputs(
        (venta_row(2, customer="Juana"), venta_row(3, customer=None, payment="Efectivo")),
        VARIETY_NAMES,
    )

    assert not isinstance(with_customer, CellProblem)
    assert with_customer.has_customer is True
    assert not isinstance(without, CellProblem)
    assert without.has_customer is False


def test_grams_and_variety_key_and_note_pass_through() -> None:
    row = venta_row(2, quantity=Quantity.of("3.5"), note="una nota")
    [result] = sale_inputs((row,), VARIETY_NAMES)

    assert not isinstance(result, CellProblem)
    assert result.variety_key == "variedad a"
    assert result.quantity == Quantity.of("3.5")
    assert result.note == "una nota"
