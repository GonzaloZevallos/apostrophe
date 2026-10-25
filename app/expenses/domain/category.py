"""Expense categories (CONTEXT.md: Expense category).

A category belongs to one business; its name follows the shared name rule
(`app/shared/names.py`), the same rule a variety's name follows. "In use" is never
stored: `check_removable` is handed the count of expenses currently filed under the
category, computed by the repository at the moment of the call.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem

NAME_MAX_LENGTH = 60

# Created only when a business opens (migration 0003, or `open_default_categories`
# for a new business); never restored once a business removes one.
DEFAULT_CATEGORY_NAMES = ("Growing supplies", "Packaging", "Shipping and transport", "Other")


class ExpenseRuleBroken(ValueError):
    """A rule of expenses or their categories was broken; the message says which."""

    code: ClassVar[str] = "expense.rule_broken"


class InvalidCategoryName(ExpenseRuleBroken):
    code: ClassVar[str] = "expense_category.name_invalid"


class CategoryNotFound(LookupError):
    code: ClassVar[str] = "expense_category.not_found"

    def __init__(self, category_id: int) -> None:
        super().__init__(f"no category {category_id}")


class CategoryNameTaken(ValueError):
    """Not an `ExpenseRuleBroken`: it answers 409, not 422."""

    code: ClassVar[str] = "expense_category.name_taken"

    def __init__(self) -> None:
        super().__init__("another category of the business already has that name")


class CategoryInUse(ValueError):
    """Not an `ExpenseRuleBroken`: it answers 409, not 422."""

    code: ClassVar[str] = "expense_category.in_use"

    def __init__(self) -> None:
        super().__init__("the category still has expenses and cannot be removed")


@dataclass(frozen=True)
class CategoryName:
    """A category's name, with inner whitespace collapsed. Two names that differ only
    in case are the same name (`key`)."""

    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise InvalidCategoryName("a category needs a name")
        if problem is NameProblem.UNTRIMMED:
            raise InvalidCategoryName("a category name has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise InvalidCategoryName(f"a category name has at most {NAME_MAX_LENGTH} characters")

    @classmethod
    def of(cls, raw: str) -> CategoryName:
        return cls(collapse_spaces(raw))

    @property
    def key(self) -> str:
        return name_key(self.value)


@dataclass
class ExpenseCategory:
    name: CategoryName
    id: int | None = None

    def rename(self, name: CategoryName) -> None:
        self.name = name

    def check_removable(self, filed_expenses: int) -> None:
        """Raises `CategoryInUse` when at least one expense is filed under this
        category right now; "in use" is never a stored fact (PM, round 1)."""
        if filed_expenses > 0:
            raise CategoryInUse()
