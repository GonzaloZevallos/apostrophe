from collections.abc import Callable
from decimal import Decimal

import pytest

from app.shared.quantity import InvalidQuantity, Quantity, TooManyDecimals


def test_grams_keep_up_to_two_decimals() -> None:
    assert Quantity.of("10.5") == Quantity(1050)
    assert Quantity.of(Decimal("0.25")).as_decimal() == Decimal("0.25")
    assert Quantity.of(3) == Quantity(300)


@pytest.mark.parametrize("value", ["abc", "NaN", "Infinity"])
def test_anything_else_is_not_grams(value: str) -> None:
    with pytest.raises(InvalidQuantity):
        Quantity.of(value)


@pytest.mark.parametrize("value", ["0.001", "2.555", "7.123", "1.005"])
def test_a_value_finer_than_a_hundredth_is_too_many_decimals(value: str) -> None:
    """Not rounded and not truncated: refused, with its own code (invariant 4)."""
    with pytest.raises(TooManyDecimals) as exc_info:
        Quantity.of(value)

    assert exc_info.value.code == "quantity.too_many_decimals"
    assert not isinstance(exc_info.value, InvalidQuantity)


@pytest.mark.parametrize("value", ["0.001", "abc", "NaN", "Infinity", "7.123"])
def test_invalid_grams_never_echoes_what_was_submitted(value: str) -> None:
    """The message is fixed: a caller that logs or answers with it never repeats the
    grams someone typed (CODING_STANDARDS.md section 9)."""
    with pytest.raises((InvalidQuantity, TooManyDecimals)) as exc_info:
        Quantity.of(value)

    assert value not in str(exc_info.value)


def test_invalid_grams_messages_do_not_vary_with_the_input() -> None:
    """Two different unparsable values raise the identical message; so do two
    different over-precise ones, proving neither message is built from the value."""
    not_a_number = {str(_raised_by(Quantity.of, "abc")), str(_raised_by(Quantity.of, "NaN"))}
    too_precise = {str(_raised_by(Quantity.of, "0.001")), str(_raised_by(Quantity.of, "7.123"))}

    assert len(not_a_number) == 1
    assert len(too_precise) == 1


def _raised_by(
    func: Callable[[str], Quantity], value: str
) -> InvalidQuantity | TooManyDecimals:
    with pytest.raises((InvalidQuantity, TooManyDecimals)) as exc_info:
        func(value)
    return exc_info.value


def test_grams_may_be_negative_and_add_up_exactly() -> None:
    total = Quantity.of("0.1") + Quantity.of("0.2") - Quantity.of("0.5")

    assert total == Quantity.of("-0.2")
    assert not total.is_positive
