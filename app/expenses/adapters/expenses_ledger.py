"""`ExpensesLedger`: results' port for every expense, with its stored `name_key`
(ADR-0020). Built for one business."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import money_scale_factor, scaled
from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.results.application.ports import ExpenseRecord
from app.shared.money import Money


class SqlExpensesLedger:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> list[ExpenseRecord]:
        factor = money_scale_factor(self._session, self._business_id)
        statement = (
            select(
                ExpenseRow.spent_on,
                scaled(ExpenseRow.amount, factor),
                ExpenseRow.expense_category_id,
                ExpenseCategoryRow.name,
                ExpenseCategoryRow.name_key,
            )
            .join(
                ExpenseCategoryRow,
                (ExpenseCategoryRow.id == ExpenseRow.expense_category_id)
                & (ExpenseCategoryRow.business_id == self._business_id),
            )
            .where(ExpenseRow.business_id == self._business_id)
        )
        return [
            ExpenseRecord(day, Money(amount).whole_units(), category_id, name, name_key)
            for day, amount, category_id, name, name_key in self._session.execute(statement).all()
        ]
