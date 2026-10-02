"""`SqlExpenseCategories` translates a constraint violation into a domain error, `from
None`, told apart by which statement raised it (CODING_STANDARDS §9). A business is
opened through the fixtures first, so the session itself is still real; only the
expense row is inserted by hand, because this is a repository seam test, not a
behaviour test.
"""

from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.adapters.tables import ExpenseRow
from app.expenses.domain.category import (
    CategoryInUse,
    CategoryName,
    CategoryNameTaken,
    ExpenseCategory,
)

# `client` opens the first (and, in these tests, only) business on a fresh engine.
BUSINESS_ID = 1


def test_remove_raises_category_in_use_when_an_expense_is_filed_under_it(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        categories = SqlExpenseCategories(session, BUSINESS_ID)
        category = categories.add(ExpenseCategory(CategoryName.of("Fletes")))
        session.commit()
        assert category.id is not None
        session.add(
            ExpenseRow(
                business_id=BUSINESS_ID,
                category_id=category.id,
                spent_on=date(2026, 10, 1),
                amount=100,
                detail="una compra",
                recorded_at=datetime(2026, 10, 1, tzinfo=UTC),
            )
        )
        session.commit()

        with pytest.raises(CategoryInUse):
            categories.remove(category.id)


def test_add_raises_category_name_taken_when_the_unique_key_collides(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        categories = SqlExpenseCategories(session, BUSINESS_ID)
        categories.add(ExpenseCategory(CategoryName.of("Fletes")))
        session.commit()

        with pytest.raises(CategoryNameTaken):
            # Calls `add` directly, bypassing the use case's own `by_key` check, so the
            # translation under test is the repository's, not the use case's.
            categories.add(ExpenseCategory(CategoryName.of("fletes")))
