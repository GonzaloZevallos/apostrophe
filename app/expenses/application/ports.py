from typing import Protocol

from app.expenses.domain.category import CategoryName, ExpenseCategory
from app.expenses.domain.expense import Expense
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import CategorizedExpense
from app.shared.language import Language


class ExpenseCategories(Protocol):
    """The expense categories of one business: the business is fixed when the store is
    built, so nothing here can reach another business's categories (docs/adr/0004).
    `add` and `save` write without committing and return the category as stored, with
    its id."""

    def list(self) -> list[ExpenseCategory]: ...

    def by_id(self, category_id: int) -> ExpenseCategory | None: ...

    def by_key(self, key: str) -> ExpenseCategory | None: ...

    def add(self, category: ExpenseCategory) -> ExpenseCategory: ...

    def save(self, category: ExpenseCategory) -> ExpenseCategory: ...

    def remove(self, category_id: int) -> None: ...

    def count_filed_under(self, category_id: int) -> int: ...


class Expenses(Protocol):
    """The expenses of one business: the business is fixed when the store is built, so
    nothing here can reach another business's expenses (docs/adr/0004). `add` and
    `save` write without committing and return the expense as stored, with its id."""

    def by_id(self, expense_id: int) -> Expense | None: ...

    def add(self, expense: Expense) -> Expense: ...

    def save(self, expense: Expense) -> Expense: ...

    def remove(self, expense_id: int) -> None: ...

    def in_month(self, month: Month) -> list[CategorizedExpense]: ...


class CategoryDefaults(Protocol):
    def for_language(self, language: Language) -> tuple[CategoryName, ...]:
        """The four categories a business opened in `language` starts with, in order,
        English for a language the copy has no catalog for."""
        ...
