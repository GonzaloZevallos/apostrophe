from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.expenses.domain.category import (
    CategoryInUse,
    CategoryName,
    CategoryNameTaken,
    ExpenseCategory,
)


class SqlExpenseCategories:
    """The `ExpenseCategories` port over SQLAlchemy, for one business. Every statement
    filters on that business; a category of another business is, from here, a category
    that does not exist (docs/adr/0004). Writes flush; the use case commits.

    `IntegrityError` is never let through: it would carry SQL, and which unique or
    foreign key fired is told apart here by which statement raised it, not by parsing
    the error text."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def list(self) -> list[ExpenseCategory]:
        statement = (
            select(ExpenseCategoryRow)
            .where(ExpenseCategoryRow.business_id == self._business_id)
            .order_by(ExpenseCategoryRow.name_key)
        )
        return [_category(row) for row in self._session.scalars(statement)]

    def by_id(self, category_id: int) -> ExpenseCategory | None:
        row = self._row(category_id)
        return None if row is None else _category(row)

    def by_key(self, key: str) -> ExpenseCategory | None:
        statement = select(ExpenseCategoryRow).where(
            ExpenseCategoryRow.business_id == self._business_id,
            ExpenseCategoryRow.name_key == key,
        )
        row = self._session.scalar(statement)
        return None if row is None else _category(row)

    def add(self, category: ExpenseCategory) -> ExpenseCategory:
        row = ExpenseCategoryRow(
            business_id=self._business_id, name=category.name.value, name_key=category.name.key
        )
        self._session.add(row)
        try:
            self._session.flush()
        except IntegrityError:
            raise CategoryNameTaken() from None
        return _category(row)

    def save(self, category: ExpenseCategory) -> ExpenseCategory:
        assert category.id is not None, "save takes a category that was added"
        row = self._row(category.id)
        assert row is not None, "save takes a category of this business"
        row.name = category.name.value
        row.name_key = category.name.key
        try:
            self._session.flush()
        except IntegrityError:
            raise CategoryNameTaken() from None
        return _category(row)

    def remove(self, category_id: int) -> None:
        row = self._row(category_id)
        assert row is not None, "remove takes a category of this business"
        self._session.delete(row)
        try:
            self._session.flush()
        except IntegrityError:
            raise CategoryInUse() from None

    def count_filed_under(self, category_id: int) -> int:
        statement = (
            select(func.count())
            .select_from(ExpenseRow)
            .where(
                ExpenseRow.business_id == self._business_id,
                ExpenseRow.category_id == category_id,
            )
        )
        return self._session.scalar(statement) or 0

    def _row(self, category_id: int) -> ExpenseCategoryRow | None:
        statement = select(ExpenseCategoryRow).where(
            ExpenseCategoryRow.id == category_id,
            ExpenseCategoryRow.business_id == self._business_id,
        )
        return self._session.scalar(statement)


def _category(row: ExpenseCategoryRow) -> ExpenseCategory:
    return ExpenseCategory(name=CategoryName(row.name), id=row.id)
