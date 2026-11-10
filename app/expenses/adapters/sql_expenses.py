from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db import money_scale_factor, money_stored_value, scaled
from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.expenses.domain.expense import Expense
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import CategorizedExpense
from app.shared.money import Money


class SqlExpenses:
    """The `Expenses` port over SQLAlchemy, for one business. Every statement filters
    on that business; an expense of another business is, from here, an expense that
    does not exist (docs/adr/0004). Writes flush; the use case commits."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def by_id(self, expense_id: int) -> Expense | None:
        return self._read(expense_id)

    def add(self, expense: Expense) -> Expense:
        row = ExpenseRow(
            business_id=self._business_id,
            expense_category_id=expense.category_id,
            spent_on=expense.spent_on,
            amount=self._stored(expense.amount),
            detail=expense.detail,
            recorded_at=expense.recorded_at,
        )
        self._session.add(row)
        self._session.flush()
        stored = self._read(row.id)
        assert stored is not None, "the expense just added still exists"
        return stored

    def save(self, expense: Expense) -> Expense:
        assert expense.id is not None, "save takes an expense that was added"
        row = self._row(expense.id)
        assert row is not None, "save takes an expense of this business"
        row.expense_category_id = expense.category_id
        row.spent_on = expense.spent_on
        row.amount = self._stored(expense.amount)
        row.detail = expense.detail
        self._session.flush()
        stored = self._read(expense.id)
        assert stored is not None, "the expense just saved still exists"
        return stored

    def remove(self, expense_id: int) -> None:
        row = self._row(expense_id)
        assert row is not None, "remove takes an expense of this business"
        self._session.delete(row)
        self._session.flush()

    def in_month(self, month: Month) -> list[CategorizedExpense]:
        # Ordered spent_on DESC, recorded_at DESC, id DESC: nowhere else computes this
        # order. Joined with the category row for its name, so the total and every
        # subtotal can be summed in the domain, never by a SQL aggregate.
        factor = money_scale_factor(self._session, self._business_id)
        statement = (
            select(
                ExpenseRow,
                scaled(ExpenseRow.amount, factor),
                ExpenseCategoryRow.name,
                ExpenseCategoryRow.name_key,
            )
            .join(
                ExpenseCategoryRow,
                and_(
                    ExpenseCategoryRow.business_id == ExpenseRow.business_id,
                    ExpenseCategoryRow.id == ExpenseRow.expense_category_id,
                ),
            )
            .where(
                ExpenseRow.business_id == self._business_id,
                ExpenseRow.spent_on >= month.first_day,
                ExpenseRow.spent_on < month.next_first_day,
            )
            .order_by(
                ExpenseRow.spent_on.desc(), ExpenseRow.recorded_at.desc(), ExpenseRow.id.desc()
            )
        )
        return [
            CategorizedExpense(_expense(row, amount), name, name_key)
            for row, amount, name, name_key in self._session.execute(statement)
        ]

    def _stored(self, units: int) -> int:
        """A domain amount, whole units, as the integer this business's column holds."""
        return money_stored_value(self._session, self._business_id, Money.of_units(units))

    def _read(self, expense_id: int) -> Expense | None:
        factor = money_scale_factor(self._session, self._business_id)
        found = self._session.execute(
            select(ExpenseRow, scaled(ExpenseRow.amount, factor)).where(
                ExpenseRow.id == expense_id, ExpenseRow.business_id == self._business_id
            )
        ).first()
        return None if found is None else _expense(found[0], found[1])

    def _row(self, expense_id: int) -> ExpenseRow | None:
        statement = select(ExpenseRow).where(
            ExpenseRow.id == expense_id, ExpenseRow.business_id == self._business_id
        )
        return self._session.scalar(statement)


def _expense(row: ExpenseRow, hundredths: int) -> Expense:
    """The row with its amount read in hundredths; whole units or `MoneyNotRepresentable`."""
    return Expense(
        spent_on=row.spent_on,
        category_id=row.expense_category_id,
        amount=Money(hundredths).whole_units(),
        detail=row.detail,
        recorded_at=row.recorded_at,
        id=row.id,
    )
