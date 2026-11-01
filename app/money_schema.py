"""The one money schema type for a request body (docs/adr/0058).

Money on the wire is the value in currency units, `11000` or `11000.50`, read as a
`Decimal` and never kept as a float. No request carries decimals or a scale, and whether
an amount has more places than the business's own decimals is checked where that business
is known, not here.

It lives beside `app/db.py` rather than in `app/shared/` because it is a pydantic type:
`app/shared/` is imported by the domain, which imports no framework.

pydantic hands a JSON decimal literal over as a float, so a literal with 16 or more
significant digits may already have been rounded by the time this type sees it. It is
refused rather than stored as a different amount. An integer literal of any length reaches
it exact, and so do decimal literals of up to 15 significant digits.
"""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Annotated, Any

from pydantic import AfterValidator, BeforeValidator, ValidationInfo

from app.shared.money import Money

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
    # Money.of raises InvalidMoney, a ValueError with a fixed message, which pydantic
    # reports as a validation error.
    money = Money.of(value)
    return money.as_decimal() if money.hundredths == 0 else value


MoneyAmount = Annotated[Decimal, BeforeValidator(_as_decimal), AfterValidator(_checked)]
