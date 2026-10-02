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


def test_grams_may_be_negative_and_add_up_exactly() -> None:
    total = Grams.of("0.1") + Grams.of("0.2") - Grams.of("0.5")

    assert total == Grams.of("-0.2")
    assert not total.is_positive
