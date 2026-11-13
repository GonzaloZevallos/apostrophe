"""The payment method's domain rules, with no database."""

from datetime import UTC, datetime

import pytest

from app.payment_methods.domain.errors import InUse, LastOffered, NameRequired, NameTooLong
from app.payment_methods.domain.method import (
    DEFAULT_ICON,
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodName,
)


def _method(archived: bool = False) -> PaymentMethod:
    return PaymentMethod(
        id=1,
        name=PaymentMethodName.of("Cash"),
        icon=PaymentMethodIcon.BANKNOTE,
        position=1,
        archived_at=datetime(2026, 1, 1, tzinfo=UTC) if archived else None,
    )


def test_a_blank_name_is_refused() -> None:
    with pytest.raises(NameRequired):
        PaymentMethodName.of("   ")


def test_sixty_characters_are_allowed_and_sixty_one_are_not() -> None:
    assert PaymentMethodName.of("x" * 60).value == "x" * 60
    with pytest.raises(NameTooLong):
        PaymentMethodName.of("x" * 61)


def test_the_key_ignores_case_and_spaces() -> None:
    assert PaymentMethodName.of("  Mercado   PAGO ").name_key == "mercado pago"
    assert PaymentMethodName.of("Cash").name_key == PaymentMethodName.of(" cASH ").name_key


def test_the_icon_set_is_closed_and_neutral_by_default() -> None:
    assert {icon.value for icon in PaymentMethodIcon} == {
        "banknote",
        "coins",
        "card",
        "bank",
        "phone",
        "wallet",
        "qr",
        "other",
    }
    assert DEFAULT_ICON is PaymentMethodIcon.OTHER


def test_the_last_offered_method_cannot_be_archived_or_removed() -> None:
    with pytest.raises(LastOffered):
        _method().check_archivable(1)
    with pytest.raises(LastOffered):
        _method().check_removable(False, 1)
    _method().check_archivable(2)
    _method().check_removable(False, 2)


def test_a_method_in_use_cannot_be_removed() -> None:
    with pytest.raises(InUse):
        _method().check_removable(True, 2)


def test_an_archived_method_is_not_the_last_offered_one() -> None:
    _method(archived=True).check_removable(False, 1)
