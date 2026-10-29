"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets the
four default categories in its stored language, inside the same transaction that opens
it. Accounts never imports this module; `app/main.py` is the composition root that wires
it in."""

from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.application.manage_categories import open_default_categories
from app.expenses.application.ports import CategoryDefaults
from app.shared.language import BusinessLanguage


class ExpenseCategoriesOpening:
    def __init__(self, session: Session, defaults: CategoryDefaults) -> None:
        self._session = session
        self._defaults = defaults

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        open_default_categories(
            SqlExpenseCategories(self._session, business_id),
            self._defaults.for_language(language.language),
        )
