"""Money, to the hundredth of the currency unit (docs/adr/0058).

Held as whole hundredths so sums never drift the way floats do, whatever scale a business
stores its amounts at: the stored integer stays inside the adapter's SQL, and this value
is what the domain and the use cases hold. Signed: whether an amount must be positive is
the caller's rule, not this type's.

Nothing here divides with `//` or rounds with `round(`: an exact division is a `divmod`
whose remainder must be 0, and a rounding goes through `round_half_up`.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from typing import ClassVar

HUNDREDTHS_PER_UNIT = 100
MAX_DECIMALS = 2
# Digits before the decimal point an amount may have. It bounds the work `Money.of` does
# for a literal such as 1e999999999, and is far beyond any real amount.
MAX_INTEGER_DIGITS = 18
SCALE_FACTORS = (1, 100)


class InvalidMoney(ValueError):
    """An amount was invalid. The message is a fixed literal, built from no constructor
    argument, so it never repeats what was submitted (CODING_STANDARDS.md section 9)."""

    code: ClassVar[str] = "money.invalid"


class MoneyNotRepresentable(ValueError):
    """An amount cannot be held exactly at the business's money scale. The message is a
    fixed literal and never carries the amount (CODING_STANDARDS.md section 9)."""

    code: ClassVar[str] = "money.not_representable"


class TooManyDecimals(ValueError):
    """An amount has more decimals than the business shows. The message is a fixed
    literal and never carries the amount (CODING_STANDARDS.md section 9)."""

    code: ClassVar[str] = "money.too_many_decimals"

    def __init__(self) -> None:
        super().__init__("the amount has more decimals than the business allows")


def _exact_hundredths(amount: Decimal) -> int | None:
    """The amount's whole hundredths, or None when it has more than two decimals.

    Reads the digits and the exponent instead of multiplying, so no arithmetic context
    ever rounds a long amount."""
    sign, digits, exponent = amount.as_tuple()
    if not isinstance(exponent, int):
        raise InvalidMoney("the amount must be a number")
    if amount.adjusted() >= MAX_INTEGER_DIGITS:
        raise InvalidMoney("the amount is too large")
    magnitude = int("".join(str(digit) for digit in digits))
    shift = exponent + MAX_DECIMALS
    hundredths: int
    if shift >= 0:
        hundredths = magnitude * 10**shift
    else:
        if -shift > len(digits):
            # Smaller than a hundredth whatever its digits: nothing to divide by 10**huge.
            return None if magnitude else 0
        hundredths, remainder = divmod(magnitude, 10**-shift)
        if remainder != 0:
            return None
    return -hundredths if sign else hundredths


@dataclass(frozen=True, order=True)
class Money:
    hundredths: int

    @classmethod
    def of(cls, value: Decimal | int | str) -> Money:
        if isinstance(value, bool) or not isinstance(value, Decimal | int | str):
            raise InvalidMoney("the amount must be a number")
        try:
            amount = Decimal(value)
        except InvalidOperation as exc:
            raise InvalidMoney("the amount must be a number") from exc
        if not amount.is_finite():
            raise InvalidMoney("the amount must be a number")
        hundredths = _exact_hundredths(amount)
        if hundredths is None:
            raise InvalidMoney("an amount allows at most two decimals")
        return cls(hundredths)

    @classmethod
    def of_units(cls, units: int) -> Money:
        """A whole number of currency units as money."""
        return cls(units * HUNDREDTHS_PER_UNIT)

    def whole_units(self) -> int:
        """The amount as a whole number of currency units. Exact or it raises
        `MoneyNotRepresentable`: cents are never truncated and never rounded."""
        units, remainder = divmod(self.hundredths, HUNDREDTHS_PER_UNIT)
        if remainder != 0:
            raise MoneyNotRepresentable("the amount is not a whole number of units")
        return units

    def as_decimal(self) -> Decimal:
        return Decimal(self.hundredths) / HUNDREDTHS_PER_UNIT

    def in_units_of(self, factor: int) -> int:
        """The amount in stored units, `factor` hundredths each: 1 for a business at
        scale 2, 100 for one at scale 0. Raises when it is not a whole number of them."""
        if factor not in SCALE_FACTORS:
            raise ValueError("the money scale factor must be 1 or 100")
        units, remainder = divmod(self.hundredths, factor)
        if remainder != 0:
            raise MoneyNotRepresentable("the amount does not fit the business's money scale")
        return units

    def __add__(self, other: Money) -> Money:
        return Money(self.hundredths + other.hundredths)

    def __sub__(self, other: Money) -> Money:
        return Money(self.hundredths - other.hundredths)


@dataclass(frozen=True)
class MoneyFormat:
    """How a business shows money: its symbol and how many decimals. The scale it stores
    amounts at is a storage fact and is not here (docs/adr/0058)."""

    symbol: str
    decimals: int

    def __post_init__(self) -> None:
        if not self.symbol.strip():
            raise ValueError("the money symbol must not be blank")
        if type(self.decimals) is not int or not 0 <= self.decimals <= MAX_DECIMALS:
            raise ValueError("the money decimals must be a whole number from 0 to 2")


def money_within(amount: Decimal, money_format: MoneyFormat) -> Money:
    """A request's amount as `Money`, checked by value against the business's decimals:
    `10.00` passes at 0 decimals, `10.5` does not. The one place the rule lives; raises
    `TooManyDecimals`, never rounding what it refuses."""
    hundredths = _exact_hundredths(amount)
    if hundredths is None or hundredths % 10 ** (MAX_DECIMALS - money_format.decimals) != 0:
        raise TooManyDecimals
    return Money(hundredths)


def _round_half_up(value: Fraction, decimals: int) -> int:
    """An exact amount in currency units as signed hundredths, rounded half up (away from
    zero on a tie) to `decimals`, in integer arithmetic only."""
    places: int = 10**decimals
    scaled = value * places
    numerator, denominator = scaled.numerator, scaled.denominator
    rounded, _ = divmod(2 * abs(numerator) + denominator, 2 * denominator)
    signed = -rounded if numerator < 0 else rounded
    to_hundredths: int = 10 ** (MAX_DECIMALS - decimals)
    return signed * to_hundredths


def round_half_up(value: Fraction, money_format: MoneyFormat) -> Money:
    """An exact amount in currency units, rounded half up (away from zero on a tie) to the
    format's decimals, in integer arithmetic only."""
    return Money(_round_half_up(value, money_format.decimals))


def round_half_up_to_units(value: Fraction) -> int:
    """An exact amount in currency units, rounded half up (away from zero on a tie) to the
    whole unit, as a whole-unit int.

    It exists because today's domain amounts are whole-unit ints and carry no
    `MoneyFormat`; the part that turns those amounts into `Money` replaces its callers.
    Until then the two shapes coexist and no use case reads the money scale."""
    units, _ = divmod(_round_half_up(value, 0), HUNDREDTHS_PER_UNIT)
    return units
