"""`open_default_categories` (application use case): it stores the names it is given, in
order, and never commits."""

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.application.manage_categories import open_default_categories
from app.expenses.domain.category import CategoryName

# `client` opens the first (and, here, only) business on a fresh engine.
BUSINESS_ID = 1


def test_it_adds_the_given_names_without_committing(client: TestClient, engine: Engine) -> None:
    names = tuple(CategoryName.of(raw) for raw in ("Uno", "Dos", "Tres", "Cuatro"))

    with Session(engine) as session:
        categories = SqlExpenseCategories(session, BUSINESS_ID)
        before = {category.name.value for category in categories.list()}
        open_default_categories(categories, names)
        added = {category.name.value for category in categories.list()} - before
        session.rollback()
        after = {c.name.value for c in SqlExpenseCategories(session, BUSINESS_ID).list()}

    assert added == {name.value for name in names}
    assert after == before
