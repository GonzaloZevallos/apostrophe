from datetime import date

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.expenses.domain.expense import Expense
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import CategorizedExpense


class SqlExpenses:
    """The `Expenses` port over SQLAlchemy, for one business. Every statement filters
    on that business; an expense of another business is, from here, an expense that
    does not exist (docs/adr/0004). Writes flush; the use case commits."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def by_id(self, expense_id: int) -> Expense | None:
        row = self._row(expense_id)
        return None if row is None else _expense(row)

    def add(self, expense: Expense) -> Expense:
        row = ExpenseRow(
            business_id=self._business_id,
            category_id=expense.category_id,
            spent_on=expense.spent_on,
            amount=expense.amount,
            detail=expense.detail,
            recorded_at=expense.recorded_at,
        )
        self._session.add(row)
        self._session.flush()
        return _expense(row)

    def save(self, expense: Expense) -> Expense:
        assert expense.id is not None, "save takes an expense that was added"
        row = self._row(expense.id)
        assert row is not None, "save takes an expense of this business"
        row.category_id = expense.category_id
        row.spent_on = expense.spent_on
        row.amount = expense.amount
        row.detail = expense.detail
        self._session.flush()
        return _expense(row)

    def remove(self, expense_id: int) -> None:
        row = self._row(expense_id)
        assert row is not None, "remove takes an expense of this business"
        self._session.delete(row)
        self._session.flush()

    def in_month(self, month: Month) -> list[CategorizedExpense]:
        # Ordered spent_on DESC, recorded_at DESC, id DESC: nowhere else computes this
        # order. Joined with the category row for its name, so the total and every
        # subtotal can be summed in the domain, never by a SQL aggregate.
        statement = (
            select(ExpenseRow, ExpenseCategoryRow.name, ExpenseCategoryRow.name_key)
            .join(
                ExpenseCategoryRow,
                and_(
                    ExpenseCategoryRow.business_id == ExpenseRow.business_id,
                    ExpenseCategoryRow.id == ExpenseRow.category_id,
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
            CategorizedExpense(_expense(row), name, name_key)
            for row, name, name_key in self._session.execute(statement)
        ]

    def between(self, start: date, end: date) -> list[Expense]:
        """Every expense of this business dated from `start` to `end`, inclusive of
        both bounds: the one load `SqlPeriodExpenses.totals` sums per period, never a
        query per period (results' `PeriodExpenses` port, plan: "one load over
        min..max, then a sum per period")."""
        statement = select(ExpenseRow).where(
            ExpenseRow.business_id == self._business_id,
            ExpenseRow.spent_on >= start,
            ExpenseRow.spent_on <= end,
        )
        return [_expense(row) for row in self._session.scalars(statement)]

    def _row(self, expense_id: int) -> ExpenseRow | None:
        statement = select(ExpenseRow).where(
            ExpenseRow.id == expense_id, ExpenseRow.business_id == self._business_id
        )
        return self._session.scalar(statement)


def _expense(row: ExpenseRow) -> Expense:
    return Expense(
        spent_on=row.spent_on,
        category_id=row.category_id,
        amount=row.amount,
        detail=row.detail,
        recorded_at=row.recorded_at,
        id=row.id,
    )
