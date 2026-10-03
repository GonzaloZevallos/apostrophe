"""Grams, to the hundredth (docs/adr/0001).

Stored and compared as whole hundredths so sums never drift the way floats do. Signed:
an adjustment may take grams away. Whether a quantity must be positive is the caller's
rule, not this type's.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import ClassVar

HUNDREDTHS_PER_GRAM = 100


class InvalidGrams(ValueError):
    """Grams were invalid. The message is a fixed literal, built from no constructor
    argument, so it never repeats what was submitted (CODING_STANDARDS.md section 9)."""

    code: ClassVar[str] = "grams.invalid"


@dataclass(frozen=True, order=True)
class Grams:
    hundredths: int

    @classmethod
    def of(cls, value: Decimal | int | str) -> Grams:
        try:
            amount = Decimal(value)
        except InvalidOperation as exc:
            raise InvalidGrams("grams must be a number") from exc
        if not amount.is_finite():
            raise InvalidGrams("grams must be a number")
        scaled = amount * HUNDREDTHS_PER_GRAM
        if scaled != scaled.to_integral_value():
            raise InvalidGrams("grams allow at most two decimals")
        return cls(int(scaled))

    @property
    def is_positive(self) -> bool:
        return self.hundredths > 0

    def as_decimal(self) -> Decimal:
        return Decimal(self.hundredths) / HUNDREDTHS_PER_GRAM

    def __add__(self, other: Grams) -> Grams:
        return Grams(self.hundredths + other.hundredths)

    def __sub__(self, other: Grams) -> Grams:
        return Grams(self.hundredths - other.hundredths)
