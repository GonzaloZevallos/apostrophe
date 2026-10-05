"""`ExpensesLedger`: results' port for every expense, with its stored `name_key`
(ADR-0020). Built for one business."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.results.application.ports import ExpenseRecord


class SqlExpensesLedger:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> list[ExpenseRecord]:
        statement = (
            select(
                ExpenseRow.spent_on,
                ExpenseRow.amount,
                ExpenseRow.category_id,
                ExpenseCategoryRow.name,
                ExpenseCategoryRow.name_key,
            )
            .join(
                ExpenseCategoryRow,
                (ExpenseCategoryRow.id == ExpenseRow.category_id)
                & (ExpenseCategoryRow.business_id == self._business_id),
            )
            .where(ExpenseRow.business_id == self._business_id)
        )
        return [
            ExpenseRecord(
                day=day, amount=amount, category_id=category_id, name=name, name_key=name_key
            )
            for day, amount, category_id, name, name_key in self._session.execute(statement).all()
        ]
