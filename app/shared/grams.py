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
    code: ClassVar[str] = "grams.invalid"


@dataclass(frozen=True, order=True)
class Grams:
    hundredths: int

    @classmethod
    def of(cls, value: Decimal | int | str) -> Grams:
        try:
            amount = Decimal(value)
        except InvalidOperation as exc:
            raise InvalidGrams(f"{value!r} is not a number of grams") from exc
        if not amount.is_finite():
            raise InvalidGrams(f"{value!r} is not a number of grams")
        scaled = amount * HUNDREDTHS_PER_GRAM
        if scaled != scaled.to_integral_value():
            raise InvalidGrams(f"{value} has more than two decimals")
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
