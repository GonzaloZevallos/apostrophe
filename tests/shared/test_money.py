from collections.abc import Callable
from decimal import Decimal
from fractions import Fraction
from typing import Any

import pytest

from app.shared.money import (
    InvalidMoney,
    Money,
    MoneyFormat,
    MoneyNotRepresentable,
    round_half_up,
    round_half_up_to_units,
)


def test_money_keeps_up_to_two_decimals_as_hundredths() -> None:
    assert Money.of("11000") == Money(1_100_000)
    assert Money.of("11000.50") == Money(1_100_050)
    assert Money.of(Decimal("0.25")).as_decimal() == Decimal("0.25")
    assert Money.of(3) == Money(300)
    assert Money.of("-2.5") == Money(-250)


def test_a_seventeen_digit_amount_is_exact() -> None:
    assert Money.of("12345678901234567.89") == Money(1_234_567_890_123_456_789)
    assert Money.of(12345678901234567) == Money(1_234_567_890_123_456_700)


def test_negative_zero_is_zero() -> None:
    assert Money.of("-0") == Money(0)
    assert Money.of(Decimal("-0.00")) == Money(0)


def test_trailing_zeros_beyond_two_decimals_are_not_extra_decimals() -> None:
    assert Money.of("1.500") == Money(150)


@pytest.mark.parametrize(
    "value", ["0.001", "11000.123", "abc", "", "NaN", "Infinity", "-Infinity", "1e30"]
)
def test_anything_else_is_not_money(value: str) -> None:
    with pytest.raises(InvalidMoney):
        Money.of(value)


@pytest.mark.parametrize("value", [1.5, True, None, b"1", [1]])
def test_a_float_a_bool_or_a_non_number_is_not_money(value: Any) -> None:
    with pytest.raises(InvalidMoney):
        Money.of(value)


@pytest.mark.parametrize("value", ["0.001", "abc", "NaN", "Infinity", "7.123", "1e30"])
def test_invalid_money_never_echoes_what_was_submitted(value: str) -> None:
    with pytest.raises(InvalidMoney) as exc_info:
        Money.of(value)

    assert value not in str(exc_info.value)


def test_invalid_money_messages_do_not_vary_with_the_input() -> None:
    not_a_number = {str(_raised_by(Money.of, "abc")), str(_raised_by(Money.of, "NaN"))}
    too_precise = {str(_raised_by(Money.of, "0.001")), str(_raised_by(Money.of, "7.123"))}

    assert len(not_a_number) == 1
    assert len(too_precise) == 1


def _raised_by(func: Callable[[str], Money], value: str) -> InvalidMoney:
    with pytest.raises(InvalidMoney) as exc_info:
        func(value)
    return exc_info.value


def test_money_may_be_negative_and_adds_up_exactly() -> None:
    total = Money.of("0.1") + Money.of("0.2") - Money.of("0.5")

    assert total == Money.of("-0.2")


def test_money_codes_are_stable() -> None:
    assert InvalidMoney.code == "money.invalid"
    assert MoneyNotRepresentable.code == "money.not_representable"


@pytest.mark.parametrize(
    ("hundredths", "factor", "expected"),
    [(1100, 100, 11), (-1100, 100, -11), (1150, 1, 1150), (-1150, 1, -1150), (0, 100, 0)],
)
def test_in_units_of_divides_exactly(hundredths: int, factor: int, expected: int) -> None:
    assert Money(hundredths).in_units_of(factor) == expected


@pytest.mark.parametrize("hundredths", [1150, -1150, 1, -1])
def test_in_units_of_refuses_what_the_scale_cannot_hold(hundredths: int) -> None:
    with pytest.raises(MoneyNotRepresentable) as exc_info:
        Money(hundredths).in_units_of(100)

    assert str(exc_info.value) == "the amount does not fit the business's money scale"


@pytest.mark.parametrize("factor", [0, 2, 10, -100, 1000])
def test_in_units_of_takes_only_the_two_known_factors(factor: int) -> None:
    with pytest.raises(ValueError, match="the money scale factor must be 1 or 100"):
        Money(1100).in_units_of(factor)


def test_money_format_holds_a_symbol_and_decimals() -> None:
    money_format = MoneyFormat(symbol="$", decimals=2)

    assert (money_format.symbol, money_format.decimals) == ("$", 2)
    assert MoneyFormat("€", 0).decimals == 0
    assert not hasattr(money_format, "scale")


@pytest.mark.parametrize("symbol", ["", "   "])
def test_money_format_refuses_a_blank_symbol(symbol: str) -> None:
    with pytest.raises(ValueError, match="the money symbol must not be blank"):
        MoneyFormat(symbol, 0)


@pytest.mark.parametrize("decimals", [-1, 3, True, False, 1.0])
def test_money_format_refuses_decimals_outside_0_to_2(decimals: Any) -> None:
    with pytest.raises(ValueError, match="the money decimals must be a whole number from 0 to 2"):
        MoneyFormat("$", decimals)


@pytest.mark.parametrize(
    ("value", "decimals", "expected"),
    [
        (Fraction(21, 2), 0, Money(1100)),
        (Fraction(5, 2), 0, Money(300)),
        (Fraction(-5, 2), 0, Money(-300)),
        (Fraction(-21, 2), 0, Money(-1100)),
        (Fraction(49, 100), 0, Money(0)),
        (Fraction(1, 2), 0, Money(100)),
        (Fraction(1001, 1000), 2, Money(100)),
        (Fraction(1005, 1000), 2, Money(101)),
        (Fraction(-1005, 1000), 2, Money(-101)),
        (Fraction(1004, 1000), 2, Money(100)),
        (Fraction(25, 10), 1, Money(250)),
        (Fraction(125, 100), 1, Money(130)),
        (Fraction(-125, 100), 1, Money(-130)),
        (Fraction(124, 100), 1, Money(120)),
        (Fraction(11000), 0, Money(1_100_000)),
        (Fraction(-1, 1000), 2, Money(0)),
    ],
)
def test_round_half_up_rounds_ties_away_from_zero(
    value: Fraction, decimals: int, expected: Money
) -> None:
    assert round_half_up(value, MoneyFormat("$", decimals)) == expected


def test_round_half_up_is_exact_on_huge_fractions() -> None:
    huge = Fraction(10**30 * 2 + 1, 2)

    assert round_half_up(huge, MoneyFormat("$", 0)) == Money((10**30 + 1) * 100)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Fraction(5, 2), 3),
        (Fraction(-5, 2), -3),
        (Fraction(49, 20), 2),
        (Fraction(7), 7),
        (Fraction(0), 0),
    ],
)
def test_round_half_up_to_units_rounds_ties_away_from_zero(value: Fraction, expected: int) -> None:
    assert round_half_up_to_units(value) == expected


def test_round_half_up_to_units_agrees_with_round_half_up_at_zero_decimals() -> None:
    value = Fraction(123_457, 100)

    assert (
        round_half_up_to_units(value) * 100 == round_half_up(value, MoneyFormat("$", 0)).hundredths
    )
