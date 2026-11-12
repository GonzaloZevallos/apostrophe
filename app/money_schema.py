"""The one money schema type for a request body (docs/adr/0058).

Money on the wire is the value in currency units, `11000` or `11000.50`, read as a
`Decimal` and never kept as a float. No request carries decimals or a scale, and whether
an amount has more places than the business's own decimals is checked where that business
is known, not here: `money_within` in `app/shared/money.py` is the one place that rule
lives, and a request type checks only that the value is a finite number of sane size.

It lives beside `app/db.py` rather than in `app/shared/` because it is a pydantic type:
`app/shared/` is imported by the domain, which imports no framework.

pydantic hands a JSON decimal literal over as a float, so a literal with 16 or more
significant digits may already have been rounded by the time this type sees it. It is
refused rather than stored as a different amount. An integer literal of any length reaches
it exact, and so do decimal literals of up to 15 significant digits.
"""

from __future__ import annotations

import math
from contextvars import ContextVar
from decimal import Decimal
from typing import Annotated, Any

from pydantic import (
    AfterValidator,
    BeforeValidator,
    PlainSerializer,
    ValidationInfo,
    WithJsonSchema,
)

from app.shared.money import MAX_INTEGER_DIGITS

# A double round-trips every decimal literal of up to 15 significant digits.
MAX_FLOAT_DIGITS = 15


def _as_decimal(value: Any, info: ValidationInfo) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("the amount must be a JSON number, never a float")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        if info.mode != "json":
            raise ValueError("the amount must be a JSON number, never a float")
        return _from_json_float(value)
    raise ValueError("the amount must be a JSON number")


def _from_json_float(value: float) -> Decimal:
    if not math.isfinite(value):
        raise ValueError("the amount must be a number")
    literal = Decimal(repr(value))
    if len(literal.normalize().as_tuple().digits) > MAX_FLOAT_DIGITS:
        raise ValueError("the amount has more digits than a JSON decimal can carry exactly")
    return literal


def _checked(value: Decimal) -> Decimal:
    """The value in canonical form: finite, of sane size, no negative zero, no positive
    exponent such as 1E+3 and no trailing zeros. Digits are rearranged, never multiplied,
    so no arithmetic context rounds a long amount. How many decimals it has is not judged
    here."""
    if not value.is_finite():
        raise ValueError("the amount must be a number")
    if value.adjusted() >= MAX_INTEGER_DIGITS:
        raise ValueError("the amount is too large")
    sign, digits, exponent = value.as_tuple()
    assert isinstance(exponent, int)  # finite
    if not any(digits):
        return Decimal(0)
    kept = list(digits)
    while exponent < 0 and len(kept) > 1 and kept[-1] == 0:
        kept.pop()
        exponent += 1
    if exponent > 0:
        kept.extend([0] * exponent)
        exponent = 0
    return Decimal((sign, tuple(kept), exponent))


def _on_the_wire(value: Decimal) -> int | float:
    """A whole amount as a JSON integer, any other as an exact JSON number. The float
    only carries a value proven to round-trip: at most 15 significant digits, the same
    bound a request is held to, and its shortest repr reads back as the very same decimal.
    Never a string."""
    if value == value.to_integral_value():
        return int(value)
    carrier = float(value)
    if len(_checked(value).as_tuple().digits) > MAX_FLOAT_DIGITS or Decimal(repr(carrier)) != value:
        raise ValueError("the amount cannot be written exactly as a JSON number")
    return carrier


# The decimals of the business whose request is being answered. A response's domain amount
# is an int in the unit of those decimals (a hundredth at 2), and `MoneyOut` writes it in
# currency units with them. `app/money_context.py` sets it once per request, before the
# handler runs; outside a request it is 0, the whole-unit domain.
MONEY_DECIMALS: ContextVar[int] = ContextVar("money_decimals", default=0)


def _domain_on_the_wire(value: Decimal) -> int | float:
    """A domain amount (`Decimal(int)`, in the unit of the request's decimals) as the JSON
    number of currency units: `123450` at 2 decimals is `1234.5`."""
    return _on_the_wire(value.scaleb(-MONEY_DECIMALS.get()))


MoneyAmount = Annotated[Decimal, BeforeValidator(_as_decimal), AfterValidator(_checked)]

MoneyOut = Annotated[
    Decimal,
    PlainSerializer(_domain_on_the_wire, return_type=int | float, when_used="json"),
    # The serializer sends a JSON integer when the value is whole and an exact JSON number
    # otherwise, so the published contract names both.
    WithJsonSchema({"anyOf": [{"type": "integer"}, {"type": "number"}]}, mode="serialization"),
]
"""A response's money field. It holds the domain amount, an int in the unit of the
business's decimals (`Decimal(amount)`), and goes out in currency units: a JSON integer
when whole (`11000`) and otherwise an exact JSON number (`11000.5`), never a string."""
