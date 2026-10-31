"""The units of a business (CONTEXT.md: Unit).

`Unit` itself, the frozen value other hexagons read, lives in `app/shared/unit.py`; this
module holds what only the units hexagon builds: the name and the label a seller types, and
the draft of a unit not stored yet. A name follows the shared name rule
(`app/shared/names.py`), the same rule an expense category follows; labels may repeat.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem
from app.shared.unit import MAX_DECIMALS, MIN_DECIMALS, Unit

NAME_MAX_LENGTH = 60
LABEL_MAX_LENGTH = 20

# What a new business starts with, and what the spreadsheet import gives its products
# (docs/product/units.md): the default is neutral, the imported one is the sheet's own data.
DEFAULT_NAME = "unit"
DEFAULT_LABEL = "unit"
DEFAULT_DECIMALS = 0
IMPORTED_NAME = "grams"
IMPORTED_LABEL = "g"
IMPORTED_DECIMALS = 2


class UnitRuleBroken(ValueError):
    """A rule of units was broken; the message says which and repeats nothing typed."""

    code: ClassVar[str] = "unit.rule_broken"


class InvalidUnitName(UnitRuleBroken):
    code: ClassVar[str] = "unit.name_invalid"


class InvalidUnitLabel(UnitRuleBroken):
    code: ClassVar[str] = "unit.label_invalid"


class InvalidUnitDecimals(UnitRuleBroken):
    code: ClassVar[str] = "unit.decimals_invalid"


class UnitNameTaken(UnitRuleBroken):
    """Another unit of the business has this name, ignoring case. Fixed text: the name is
    never repeated (docs/adr/0005)."""

    code: ClassVar[str] = "unit.name_taken"

    def __init__(self) -> None:
        super().__init__("another unit of the business already has this name")


class UnitInUse(UnitRuleBroken):
    """A product, archived or not, still has this unit. Fixed text: no count, no name."""

    code: ClassVar[str] = "unit.in_use"

    def __init__(self) -> None:
        super().__init__("a product uses this unit, so it cannot be deleted")


class LastUnit(UnitRuleBroken):
    """A business always keeps at least one unit."""

    code: ClassVar[str] = "unit.last_unit"

    def __init__(self) -> None:
        super().__init__("the business needs at least one unit")


class DecimalsInUse(UnitRuleBroken):
    """Fewer decimals than a recorded quantity of the unit uses. Fixed text."""

    code: ClassVar[str] = "unit.decimals_in_use"

    def __init__(self) -> None:
        super().__init__("a recorded quantity of this unit already uses more decimals")


@dataclass(frozen=True)
class UnitName:
    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise InvalidUnitName("a unit needs a name")
        if problem is NameProblem.UNTRIMMED:
            raise InvalidUnitName("a unit name has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise InvalidUnitName(f"a unit name has at most {NAME_MAX_LENGTH} characters")

    @classmethod
    def of(cls, raw: str) -> UnitName:
        return cls(collapse_spaces(raw))

    @property
    def folded(self) -> str:
        """The case-insensitive key two names are compared by."""
        return name_key(self.value)


@dataclass(frozen=True)
class UnitLabel:
    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, LABEL_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise InvalidUnitLabel("a unit needs a label")
        if problem is NameProblem.UNTRIMMED:
            raise InvalidUnitLabel("a unit label has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise InvalidUnitLabel(f"a unit label has at most {LABEL_MAX_LENGTH} characters")

    @classmethod
    def of(cls, raw: str) -> UnitLabel:
        return cls(collapse_spaces(raw))


@dataclass(frozen=True)
class UnitDraft:
    """A unit that is not stored yet."""

    name: UnitName
    label: UnitLabel
    decimals: int

    def __post_init__(self) -> None:
        if not MIN_DECIMALS <= self.decimals <= MAX_DECIMALS:
            raise InvalidUnitDecimals("a unit has between 0 and 2 decimals")


@dataclass(frozen=True)
class CountedUnit:
    """A stored unit with how many products, archived ones included, use it."""

    unit: Unit
    product_count: int
