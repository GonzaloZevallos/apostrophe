"""The payment method's name and rules (`app.payment_methods.domain`)."""

import pytest

from app.payment_methods.domain.method import (
    LastActivePaymentMethod,
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodInUse,
    PaymentMethodName,
    PaymentMethodNameEmpty,
    PaymentMethodNameTooLong,
)
from app.shared.payment_method import PaymentMethodLabel


def _method(*, archived: bool = False) -> PaymentMethod:
    return PaymentMethod(
        id=7,
        name=PaymentMethodName.of("Mercado Pago"),
        icon=PaymentMethodIcon.PHONE,
        position=3,
        archived=archived,
    )


def test_a_name_is_trimmed_and_its_inner_spaces_collapsed() -> None:
    assert PaymentMethodName.of("  Mercado   Pago ").value == "Mercado Pago"


def test_two_names_differing_only_in_case_or_spaces_are_the_same_name() -> None:
    assert PaymentMethodName.of("Mercado Pago").name_key == PaymentMethodName.of("mercadopago ").name_key
    assert PaymentMethodName.of("Cash").name_key != PaymentMethodName.of("Transfer").name_key


@pytest.mark.parametrize("raw", ["", "   "])
def test_an_empty_name_is_refused(raw: str) -> None:
    with pytest.raises(PaymentMethodNameEmpty):
        PaymentMethodName.of(raw)


def test_a_name_of_forty_characters_is_accepted_and_forty_one_is_refused() -> None:
    assert PaymentMethodName.of("a" * 40).value == "a" * 40
    with pytest.raises(PaymentMethodNameTooLong):
        PaymentMethodName.of("a" * 41)


def test_the_icon_set_is_the_six_neutral_ones_and_generic_is_the_default() -> None:
    assert {icon.value for icon in PaymentMethodIcon} == {
        "wallet",
        "bank",
        "card",
        "coins",
        "phone",
        "generic",
    }
    assert PaymentMethodIcon.DEFAULT is PaymentMethodIcon.GENERIC


def test_the_last_active_method_cannot_be_archived() -> None:
    with pytest.raises(LastActivePaymentMethod):
        _method().check_archivable(active_count=1)
    _method().check_archivable(active_count=2)


def test_archiving_an_archived_method_is_never_refused() -> None:
    _method(archived=True).check_archivable(active_count=1)


def test_the_last_active_method_cannot_be_deleted() -> None:
    with pytest.raises(LastActivePaymentMethod):
        _method().check_deletable(active_count=1, used=False)


def test_a_method_in_use_cannot_be_deleted_even_when_others_remain() -> None:
    with pytest.raises(PaymentMethodInUse):
        _method().check_deletable(active_count=3, used=True)


def test_an_archived_method_that_nothing_uses_can_be_deleted_whatever_is_active() -> None:
    _method(archived=True).check_deletable(active_count=1, used=False)


def test_the_label_is_the_id_name_and_icon_and_refuses_what_is_not() -> None:
    label = _method().label()
    assert label == PaymentMethodLabel(id=7, name="Mercado Pago", icon="phone")
    with pytest.raises(ValueError, match="icon"):
        PaymentMethodLabel(id=7, name="x", icon="")
    with pytest.raises(ValueError, match="name"):
        PaymentMethodLabel(id=7, name="", icon="phone")
    with pytest.raises(ValueError, match="id"):
        PaymentMethodLabel(id=0, name="x", icon="phone")
