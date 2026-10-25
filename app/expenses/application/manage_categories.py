from app.expenses.application.ports import ExpenseCategories
from app.expenses.domain.category import (
    CategoryName,
    CategoryNameTaken,
    CategoryNotFound,
    ExpenseCategory,
)
from app.shared.transaction import Transaction


def list_categories(categories: ExpenseCategories) -> list[ExpenseCategory]:
    return categories.list()


def get_category(categories: ExpenseCategories, category_id: int) -> ExpenseCategory:
    category = categories.by_id(category_id)
    if category is None:
        raise CategoryNotFound(category_id)
    return category


def add_category(
    categories: ExpenseCategories, transaction: Transaction, raw_name: str
) -> ExpenseCategory:
    name = CategoryName.of(raw_name)
    if categories.by_key(name.key) is not None:
        raise CategoryNameTaken()
    category = categories.add(ExpenseCategory(name))
    transaction.commit()
    return category


def rename_category(
    categories: ExpenseCategories, transaction: Transaction, category_id: int, raw_name: str
) -> ExpenseCategory:
    category = get_category(categories, category_id)
    name = CategoryName.of(raw_name)
    existing = categories.by_key(name.key)
    if existing is not None and existing.id != category_id:
        raise CategoryNameTaken()
    category.rename(name)
    stored = categories.save(category)
    transaction.commit()
    return stored


def remove_category(
    categories: ExpenseCategories, transaction: Transaction, category_id: int
) -> None:
    category = get_category(categories, category_id)
    assert category.id is not None
    category.check_removable(categories.count_filed_under(category.id))
    categories.remove(category.id)
    transaction.commit()


def open_default_categories(categories: ExpenseCategories, names: tuple[CategoryName, ...]) -> None:
    """Called once, when a business opens (docs/adr/0006), with the names of its stored
    language. Never commits: the caller's own transaction covers it, together with the
    rest of what opening a business does."""
    for name in names:
        categories.add(ExpenseCategory(name))
