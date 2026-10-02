from collections.abc import Callable
from decimal import Decimal

import pytest

from app.shared.grams import Grams, InvalidGrams


def test_grams_keep_up_to_two_decimals() -> None:
    assert Grams.of("10.5") == Grams(1050)
    assert Grams.of(Decimal("0.25")).as_decimal() == Decimal("0.25")
    assert Grams.of(3) == Grams(300)


@pytest.mark.parametrize("value", ["0.001", "abc", "NaN", "Infinity"])
def test_anything_else_is_not_grams(value: str) -> None:
    with pytest.raises(InvalidGrams):
        Grams.of(value)


@pytest.mark.parametrize("value", ["0.001", "abc", "NaN", "Infinity", "7.123"])
def test_invalid_grams_never_echoes_what_was_submitted(value: str) -> None:
    """The message is fixed: a caller that logs or answers with it never repeats the
    grams someone typed (CODING_STANDARDS.md section 9)."""
    with pytest.raises(InvalidGrams) as exc_info:
        Grams.of(value)

    assert value not in str(exc_info.value)


def test_invalid_grams_messages_do_not_vary_with_the_input() -> None:
    """Two different unparsable values raise the identical message; so do two
    different over-precise ones, proving neither message is built from the value."""
    not_a_number = {str(_raised_by(Grams.of, "abc")), str(_raised_by(Grams.of, "NaN"))}
    too_precise = {str(_raised_by(Grams.of, "0.001")), str(_raised_by(Grams.of, "7.123"))}

    assert len(not_a_number) == 1
    assert len(too_precise) == 1


def _raised_by(func: Callable[[str], Grams], value: str) -> InvalidGrams:
    with pytest.raises(InvalidGrams) as exc_info:
        func(value)
    return exc_info.value


def test_grams_may_be_negative_and_add_up_exactly() -> None:
    total = Grams.of("0.1") + Grams.of("0.2") - Grams.of("0.5")

    assert total == Grams.of("-0.2")
    assert not total.is_positive
