"""`ExpensesUsingAMethod` answers which methods an Expense of its own business points at
(docs/adr/20261124-a-payment-method-is-in-use-when-any-payment-or-expense-points-at-it).

The engine is a bare SQLite one with the foreign keys left off (`make_engine` would turn
them on), so a row of business B can carry a method id of business A. Only the adapter's
own `business_id` filter can then keep that row out of A's answer.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.expenses.adapters.method_usage import ExpensesUsingAMethod
from app.expenses.adapters.tables import ExpenseRow
from app.tables import metadata

BUSINESS_A = 1
BUSINESS_B = 2
A_METHOD = 10
B_ONLY_METHOD = 20
UNUSED_METHOD = 30
NO_EXPENSE = 40


@pytest.fixture
def session() -> Iterator[Session]:
    engine: Engine = create_engine("sqlite://", poolclass=StaticPool)
    metadata.create_all(engine)
    with Session(engine) as opened:
        yield opened
    engine.dispose()


def _expense(session: Session, business_id: int, method_id: int | None) -> None:
    session.add(
        ExpenseRow(
            business_id=business_id,
            expense_category_id=1,
            spent_on=date(2026, 10, 2),
            amount=1_000,
            detail="fletes",
            recorded_at=datetime(2026, 10, 2, 12, 0, tzinfo=UTC),
            payment_method_id=method_id,
        )
    )
    session.flush()


@pytest.fixture
def seeded(session: Session) -> Session:
    _expense(session, BUSINESS_A, A_METHOD)
    _expense(session, BUSINESS_A, None)
    _expense(session, BUSINESS_B, B_ONLY_METHOD)
    # B's row carries A's method id: only the business filter keeps it out of A's answer.
    _expense(session, BUSINESS_B, A_METHOD)
    return session


def test_the_setup_has_foreign_keys_off_and_the_cross_row(seeded: Session) -> None:
    assert seeded.scalar(text("PRAGMA foreign_keys")) == 0
    crossing = seeded.scalar(
        select(func.count()).where(
            ExpenseRow.business_id == BUSINESS_B, ExpenseRow.payment_method_id == A_METHOD
        )
    )
    assert crossing == 1


def test_a_counts_its_own_expense_and_ignores_the_expense_with_no_method(seeded: Session) -> None:
    usage = ExpensesUsingAMethod(seeded, BUSINESS_A)

    assert usage.in_use_among([A_METHOD, UNUSED_METHOD]) == {A_METHOD}


def test_a_does_not_count_a_method_only_b_s_row_points_at(seeded: Session) -> None:
    usage = ExpensesUsingAMethod(seeded, BUSINESS_A)

    assert usage.in_use_among([B_ONLY_METHOD]) == frozenset()


def test_b_sees_its_own_rows(seeded: Session) -> None:
    usage = ExpensesUsingAMethod(seeded, BUSINESS_B)

    assert usage.in_use_among([A_METHOD, B_ONLY_METHOD, UNUSED_METHOD]) == {
        A_METHOD,
        B_ONLY_METHOD,
    }


def test_a_business_with_no_expense_counts_nothing(seeded: Session) -> None:
    assert ExpensesUsingAMethod(seeded, NO_EXPENSE).in_use_among([A_METHOD]) == frozenset()


def test_empty_input_gives_an_empty_set(seeded: Session) -> None:
    assert ExpensesUsingAMethod(seeded, BUSINESS_A).in_use_among([]) == frozenset()
