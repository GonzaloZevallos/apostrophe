from typing import Protocol

from app.expenses.domain.category import ExpenseCategory


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
