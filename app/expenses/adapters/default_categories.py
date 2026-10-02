"""Implements accounts' `BusinessOpening` port (docs/adr/0005): a new business gets the
four default categories, inside the same transaction that opens it. Accounts never
imports this module; `app/main.py` is the composition root that wires it in."""

from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.application.manage_categories import open_default_categories


class ExpenseCategoriesOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int) -> None:
        open_default_categories(SqlExpenseCategories(self._session, business_id))
