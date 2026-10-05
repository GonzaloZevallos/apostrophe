"""Implements the import's `ExpensesImport` port
(`app/spreadsheet_import/application/ports.py`) for one business: expense categories
are matched by name or added, never renamed or removed, and expenses are checked and
written exactly as `app/expenses/application/manage_expenses.py`'s own use case would,
as if entered by hand today (the plan, subtask `expenses-port`).

No code here reads, writes or counts another capability's table (the plan's
invariant): only `expense_category` and `expense`, through this hexagon's own
`SqlExpenseCategories` and `SqlExpenses`. A database id never crosses back into the
import beyond what this module returns; the `category_id` `check_expense` hands
`Expense.of` is a local ordinal that is discarded the moment the call returns.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.adapters.sql_expenses import SqlExpenses
from app.expenses.adapters.tables import ExpenseRow
from app.expenses.application.manage_categories import add_category
from app.expenses.application.manage_expenses import record_expense
from app.expenses.domain.category import CategoryName, ExpenseRuleBroken, InvalidCategoryName
from app.expenses.domain.expense import Expense, InvalidAmount, InvalidDetail, InvalidExpenseDate
from app.shared.transaction import Transaction
from app.spreadsheet_import.application.ports import Refusal
from app.spreadsheet_import.domain.rows import GastoRow

# Never stored, never returned: `check_expense` only needs `Expense.of` to run its
# date, amount and detail rules, and those don't look at the category at all.
_LOCAL_CATEGORY_ID = 1


class ExpensesImport:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._categories = SqlExpenseCategories(session, business_id)
        self._expenses = SqlExpenses(session, business_id)

    def has_records(self) -> bool:
        statement = (
            select(ExpenseRow.id).where(ExpenseRow.business_id == self._business_id).limit(1)
        )
        return self._session.scalar(statement) is not None

    def category_key(self, raw: str) -> str | Refusal:
        try:
            return CategoryName.of(raw).key
        except InvalidCategoryName as exc:
            return Refusal(exc.code)

    def check_expense(self, row: GastoRow, today: date) -> Refusal | None:
        if row.spent_on is None:
            return Refusal(InvalidExpenseDate.code)
        if row.amount is None:
            return Refusal(InvalidAmount.code)
        if row.detail is None:
            return Refusal(InvalidDetail.code)
        try:
            Expense.of(
                spent_on=row.spent_on,
                category_id=_LOCAL_CATEGORY_ID,
                amount=row.amount,
                detail=row.detail,
                today=today,
                recorded_at=_as_datetime(today),
            )
        except ExpenseRuleBroken as exc:
            return Refusal(exc.code)
        return None

    def write_category(self, name: str, transaction: Transaction) -> int:
        key = CategoryName.of(name).key
        existing = self._categories.by_key(key)
        if existing is not None:
            assert existing.id is not None
            return existing.id
        added = add_category(self._categories, transaction, name)
        assert added.id is not None
        return added.id

    def write_expense(
        self,
        category_id: int,
        row: GastoRow,
        recorded_at: datetime,
        today: date,
        transaction: Transaction,
    ) -> None:
        assert row.spent_on is not None, "write_expense takes a checked row"
        assert row.amount is not None, "write_expense takes a checked row"
        assert row.detail is not None, "write_expense takes a checked row"
        record_expense(
            self._expenses,
            self._categories,
            transaction,
            spent_on=row.spent_on,
            category_id=category_id,
            amount=row.amount,
            detail=row.detail,
            today=today,
            recorded_at=recorded_at,
        )


def _as_datetime(today: date) -> datetime:
    """A placeholder `recorded_at` for `check_expense`'s throwaway `Expense.of` call:
    never stored, never returned, just something `Expense.of`'s signature needs."""
    return datetime.combine(today, time.min, tzinfo=UTC)
