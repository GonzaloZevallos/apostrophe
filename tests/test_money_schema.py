from decimal import Decimal
from typing import Any

import pytest
from pydantic import BaseModel, TypeAdapter, ValidationError

from app.money_schema import MoneyAmount, MoneyOut


class Priced(BaseModel):
    price: MoneyAmount


def _refusal(raw: str) -> str:
    with pytest.raises(ValidationError) as exc_info:
        Priced.model_validate_json(raw)
    errors = exc_info.value.errors()
    assert len(errors) == 1
    return errors[0]["msg"]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('{"price": 11000}', Decimal("11000")),
        ('{"price": 11000.10}', Decimal("11000.10")),
        ('{"price": 11000.5}', Decimal("11000.50")),
        ('{"price": 0.25}', Decimal("0.25")),
        ('{"price": -2.5}', Decimal("-2.5")),
        ('{"price": 12345678901234567}', Decimal("12345678901234567")),
        ('{"price": 1e3}', Decimal("1000")),
        ('{"price": 1.5e2}', Decimal("150")),
    ],
)
def test_a_json_number_is_read_as_the_exact_decimal(raw: str, expected: Decimal) -> None:
    parsed = Priced.model_validate_json(raw).price

    assert isinstance(parsed, Decimal)
    assert parsed == expected


def test_a_seventeen_digit_amount_is_exact() -> None:
    assert Priced.model_validate_json('{"price": 12345678901234567}').price == 12345678901234567


def test_negative_zero_is_zero() -> None:
    parsed = Priced.model_validate_json('{"price": -0}').price

    assert parsed == 0
    assert not parsed.is_signed()
    assert not Priced.model_validate_json('{"price": -0.0}').price.is_signed()


def test_python_values_that_are_exact_pass() -> None:
    assert Priced.model_validate({"price": Decimal("11000.10")}).price == Decimal("11000.10")
    assert Priced.model_validate({"price": 11000}).price == Decimal("11000")
    assert not Priced.model_validate({"price": Decimal("-0")}).price.is_signed()


def test_a_float_is_refused_outside_json() -> None:
    assert _python_refusal(1.5) == "Value error, the amount must be a JSON number, never a float"


def test_a_bool_is_refused() -> None:
    assert _python_refusal(True) == "Value error, the amount must be a JSON number, never a float"


def test_a_decimal_nan_is_refused() -> None:
    assert _python_refusal(Decimal("NaN")) == "Input should be a finite number"


def _python_refusal(value: Any) -> str:
    with pytest.raises(ValidationError) as exc_info:
        Priced.model_validate({"price": value})
    errors = exc_info.value.errors()
    assert len(errors) == 1
    return errors[0]["msg"]


def test_decimal_places_are_not_judged_by_the_schema_type() -> None:
    """Whether an amount has more places than the business shows is `money_within`'s rule,
    checked where the business is known; the type keeps the value exact for it."""
    assert Priced.model_validate_json('{"price": 11000.123}').price == Decimal("11000.123")
    assert Priced.model_validate({"price": Decimal("0.001")}).price == Decimal("0.001")


def test_nan_and_infinity_are_refused() -> None:
    assert _refusal('{"price": NaN}') == "Value error, the amount must be a number"
    assert _refusal('{"price": Infinity}') == "Value error, the amount must be a number"
    assert _refusal('{"price": -Infinity}') == "Value error, the amount must be a number"


def test_a_json_string_is_refused_even_when_it_looks_like_a_number() -> None:
    assert _refusal('{"price": "11000"}') == "Value error, the amount must be a JSON number"
    assert _refusal('{"price": "abc"}') == "Value error, the amount must be a JSON number"


@pytest.mark.parametrize("raw", ["null", "true", "[1]", '{"a": 1}'])
def test_anything_else_is_refused(raw: str) -> None:
    with pytest.raises(ValidationError):
        Priced.model_validate_json('{"price": ' + raw + "}")


def test_a_float_literal_that_a_float_cannot_hold_is_refused_rather_than_rounded() -> None:
    """pydantic hands a JSON decimal literal over as a float, so 16 or more significant
    digits may already be rounded: refuse them instead of storing a different amount."""
    message = "Value error, the amount has more digits than a JSON decimal can carry exactly"

    assert _refusal('{"price": 123456789012345.67}') == message
    assert _refusal('{"price": 12345678901234567.89}') == message


def test_an_amount_too_large_is_refused() -> None:
    assert _refusal('{"price": 1e30}') == "Value error, the amount is too large"


def test_a_refusal_never_carries_the_amount() -> None:
    for raw in ('{"price": "7654"}', '{"price": 7654321e30}'):
        assert "7654" not in _refusal(raw)
        assert "11000" not in _refusal(raw)


def test_the_schema_type_is_a_decimal_in_the_model() -> None:
    assert Priced.model_fields["price"].annotation is Decimal


@pytest.mark.parametrize(
    ("raw", "exponent"),
    [
        ('{"price": 1e3}', 0),
        ('{"price": 1e16}', 0),
        ('{"price": 11000.50}', -1),
        ('{"price": 3}', 0),
    ],
)
def test_the_value_comes_back_without_trailing_zeros_or_a_positive_exponent(
    raw: str, exponent: int
) -> None:
    assert Priced.model_validate_json(raw).price.as_tuple().exponent == exponent


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        (Decimal("11000"), b"11000"),
        (Decimal("11000.50"), b"11000.5"),
        (Decimal("-11000.5"), b"-11000.5"),
        (Decimal("-3"), b"-3"),
        (Decimal("0"), b"0"),
        (Decimal("0.00"), b"0"),
        (Decimal("0.05"), b"0.05"),
        (Decimal("1E+3"), b"1000"),
        (Decimal("12345678901234567"), b"12345678901234567"),
    ],
)
def test_money_out_is_a_json_integer_when_whole_and_an_exact_number_otherwise(
    amount: Decimal, expected: bytes
) -> None:
    assert TypeAdapter(MoneyOut).dump_json(amount) == expected


def test_money_out_in_a_model_is_never_a_string() -> None:
    class Shown(BaseModel):
        total: MoneyOut

    assert Shown(total=Decimal("11000.50")).model_dump_json() == '{"total":11000.5}'


def test_money_out_refuses_a_figure_a_json_number_cannot_carry_exactly() -> None:
    with pytest.raises(ValueError, match="cannot be written exactly") as raised:
        TypeAdapter(MoneyOut).dump_json(Decimal("1234567890123456.78"))

    assert "1234567" not in str(raised.value)
