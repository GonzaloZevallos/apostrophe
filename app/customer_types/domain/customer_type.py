"""Customer types (CONTEXT.md: Customer type, VIP type).

A type belongs to one business and has a name, unique within it ignoring case and
spaces, and an icon from a closed set. `is_vip` marks the one type the upgrade (or the
spreadsheet import) created as the business's VIP type: the VIP type is identified by
it and never by its name (docs/adr/0070). "In use" is never stored: the delete use case
counts the customers in the type at the moment of the call.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import ClassVar

from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem

NAME_MAX_LENGTH = 40


class CustomerTypeRuleBroken(ValueError):
    """A rule of customer types was broken; the message says which. Answers 422."""

    code: ClassVar[str] = "customer_type.rule_broken"


class NameBlank(CustomerTypeRuleBroken):
    code: ClassVar[str] = "customer_type.name_blank"

    def __init__(self) -> None:
        super().__init__("a customer type needs a name")


class NameTooLong(CustomerTypeRuleBroken):
    code: ClassVar[str] = "customer_type.name_too_long"

    def __init__(self) -> None:
        super().__init__(f"a customer type name has at most {NAME_MAX_LENGTH} characters")


class IconUnknown(CustomerTypeRuleBroken):
    code: ClassVar[str] = "customer_type.icon_unknown"

    def __init__(self, raw: str) -> None:
        super().__init__(f"{raw!r} is not a customer type icon")


class NameTaken(ValueError):
    """Not a `CustomerTypeRuleBroken`: it answers 409, not 422."""

    code: ClassVar[str] = "customer_type.name_taken"

    def __init__(self) -> None:
        super().__init__("another customer type of the business already has that name")


class CustomerTypeInUse(ValueError):
    """Not a `CustomerTypeRuleBroken`: it answers 409, not 422. Carries how many
    customers are in the type, which the refusal body shows."""

    code: ClassVar[str] = "customer_type.in_use"

    def __init__(self, count: int) -> None:
        super().__init__(f"{count} customers are in the type and it cannot be deleted")
        self.count = count


class CustomerTypeNotFound(LookupError):
    code: ClassVar[str] = "customer_type.not_found"

    def __init__(self, type_id: int) -> None:
        super().__init__(f"no customer type {type_id}")


class CustomerTypeIcon(StrEnum):
    """The closed set of neutral icons. The keys are stored values: changing one is a
    data migration. The front's map is checked against the OpenAPI snapshot."""

    CIRCLE = "circle"
    STAR = "star"
    HEART = "heart"
    DIAMOND = "diamond"
    FLAG = "flag"
    TAG = "tag"
    CROWN = "crown"
    BELL = "bell"

    @classmethod
    def of(cls, raw: str) -> CustomerTypeIcon:
        try:
            return cls(raw)
        except ValueError:
            raise IconUnknown(raw) from None


DEFAULT_ICON = CustomerTypeIcon.CIRCLE


@dataclass(frozen=True)
class CustomerTypeName:
    """A type's name, trimmed with inner spaces collapsed, 1 to 40 characters. Two
    names that differ only in case or spacing are the same name (`key`)."""

    value: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "value", collapse_spaces(self.value))
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise NameBlank()
        if problem is NameProblem.TOO_LONG:
            raise NameTooLong()

    @property
    def key(self) -> str:
        return name_key(self.value)


@dataclass
class CustomerType:
    name: CustomerTypeName
    icon: CustomerTypeIcon = DEFAULT_ICON
    # Read-only: set by the upgrade and the import, never by a request.
    is_vip: bool = field(default=False, kw_only=True)
    id: int | None = field(default=None, kw_only=True)

    def rename(self, name: CustomerTypeName) -> None:
        self.name = name

    def change_icon(self, icon: CustomerTypeIcon) -> None:
        self.icon = icon

    def check_deletable(self, customers_in_type: int) -> None:
        """Raises `CustomerTypeInUse` when at least one customer is in this type
        right now; the VIP type follows the same rule."""
        if customers_in_type > 0:
            raise CustomerTypeInUse(customers_in_type)
