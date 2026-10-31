"""A unit of measure (CONTEXT.md: Unit): its name, its label and how many decimals a
quantity of it may have (docs/adr/0056).

Stored quantities stay whole hundredths whatever the unit; the decimals only decide which
submitted quantities are admitted and how they are shown, never a divisor or a storage
scale. The shared kernel imports only the standard library, so `admits` reads any value
with a `hundredths` attribute (`Quantity` is one) instead of importing it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

MIN_DECIMALS = 0
MAX_DECIMALS = 2
# A quantity is stored to the hundredth, so two decimals is the finest a unit can allow.
_STORED_DECIMALS = 2


class _InHundredths(Protocol):
    @property
    def hundredths(self) -> int: ...


@dataclass(frozen=True)
class Unit:
    id: int
    name: str
    label: str
    decimals: int

    def __post_init__(self) -> None:
        if not MIN_DECIMALS <= self.decimals <= MAX_DECIMALS:
            raise ValueError("a unit has between 0 and 2 decimals")
        if not self.name.strip() or not self.label.strip():
            raise ValueError("a unit needs a name and a label")

    def admits(self, quantity: _InHundredths) -> bool:
        """Whether `quantity` has no more decimals than this unit allows."""
        remainder: int = quantity.hundredths % 10 ** (_STORED_DECIMALS - self.decimals)
        return remainder == 0
