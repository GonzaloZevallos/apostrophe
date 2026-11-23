"""`SqlExpenses.add` and `SqlExpenses.save` guard the Payment method inside the statement
that writes (ADR-20261111-payment-methods-by-id): a method the business does not offer
now is refused by the same `INSERT … SELECT` or `UPDATE`, never by a read before it.

Businesses, categories and methods come from the `client` fixtures over HTTP (an archive
goes through the payment-methods API); only `SqlExpenses`, the seam under test, is built
and called directly over a real session.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.sql_expenses import SqlExpenses
from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.expenses.domain.expense import Expense
from app.shared.payment_method import PaymentMethodId, PaymentMethodUnavailable

RECORDED_AT = datetime(2026, 10, 2, 12, 0, tzinfo=UTC)
TODAY = date(2026, 10, 2)
METHODS = "/api/payment-methods"


def _category_id(client: TestClient) -> int:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == "Other")
    return int(category["id"])


def _business_id(engine: Engine, category_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(ExpenseCategoryRow).where(ExpenseCategoryRow.id == category_id))
        assert row is not None
        return row.business_id


def _method(client: TestClient, name: str) -> int:
    return int(next(m["id"] for m in client.get(METHODS).json() if m["name"] == name))


def _archived_method(client: TestClient, name: str) -> int:
    created = client.post(METHODS, json={"name": name})
    assert created.status_code == 201, created.text
    method_id = int(created.json()["id"])
    assert client.post(f"{METHODS}/{method_id}/archive").status_code == 204
    return method_id


def _expense(
    category_id: int, method: int | None, *, id: int | None = None, detail: str = "fletes"
) -> Expense:
    return Expense.of(
        TODAY,
        category_id,
        1_000,
        detail,
        TODAY,
        RECORDED_AT,
        id,
        payment_method=None if method is None else PaymentMethodId(method),
    )


def _count(engine: Engine, business_id: int) -> int:
    with Session(engine) as session:
        count = session.scalar(
            select(func.count())
            .select_from(ExpenseRow)
            .where(ExpenseRow.business_id == business_id)
        )
        assert count is not None
        return count


def _stored(engine: Engine, expense_id: int) -> tuple[object, ...]:
    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT payment_method_id, expense_category_id, spent_on, amount, detail "
                "FROM expense WHERE id = :id"
            ),
            {"id": expense_id},
        ).one()
    return tuple(row)


def test_add_with_no_method_stores_null(client: TestClient, engine: Engine) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)

    with Session(engine) as session:
        stored = SqlExpenses(session, business).add(_expense(category, None))
        session.commit()

    assert stored.payment_method is None
    assert stored.payment_method_label is None
    assert stored.id is not None
    assert _stored(engine, stored.id)[0] is None


def test_add_with_an_offered_method_stores_it_and_reads_its_label(
    client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    cash = _method(client, "Cash")

    with Session(engine) as session:
        stored = SqlExpenses(session, business).add(_expense(category, cash))
        session.commit()

    assert stored.payment_method == PaymentMethodId(cash)
    assert stored.payment_method_label is not None
    assert (stored.payment_method_label.id, stored.payment_method_label.name) == (cash, "Cash")


def test_add_with_an_archived_method_raises_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    archived = _archived_method(client, "Old")

    with Session(engine) as session:
        with pytest.raises(PaymentMethodUnavailable):
            SqlExpenses(session, business).add(_expense(category, archived))
        session.rollback()

    assert _count(engine, business) == 0


def test_add_with_another_businesss_method_raises_and_writes_nothing(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    foreign = _method(other_client, "Cash")

    with Session(engine) as session:
        with pytest.raises(PaymentMethodUnavailable):
            SqlExpenses(session, business).add(_expense(category, foreign))
        session.rollback()

    assert _count(engine, business) == 0


def test_add_with_a_nonexistent_method_raises_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)

    with Session(engine) as session:
        with pytest.raises(PaymentMethodUnavailable):
            SqlExpenses(session, business).add(_expense(category, 999_999))
        session.rollback()

    assert _count(engine, business) == 0


def test_save_keeping_a_method_archived_since_succeeds_and_keeps_it(
    client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    method = int(client.post(METHODS, json={"name": "Later archived"}).json()["id"])
    with Session(engine) as session:
        added = SqlExpenses(session, business).add(_expense(category, method))
        session.commit()
    assert added.id is not None
    assert client.post(f"{METHODS}/{method}/archive").status_code == 204

    with Session(engine) as session:
        saved = SqlExpenses(session, business).save(
            _expense(category, method, id=added.id, detail="edited")
        )
        session.commit()

    assert saved.payment_method == PaymentMethodId(method)
    assert saved.detail == "edited"
    assert _stored(engine, added.id)[0] == method


def test_save_to_a_different_archived_method_raises_and_leaves_the_row_unchanged(
    client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    cash = _method(client, "Cash")
    archived = _archived_method(client, "Old")
    with Session(engine) as session:
        added = SqlExpenses(session, business).add(_expense(category, cash))
        session.commit()
    assert added.id is not None
    before = _stored(engine, added.id)

    with Session(engine) as session:
        with pytest.raises(PaymentMethodUnavailable):
            SqlExpenses(session, business).save(
                _expense(category, archived, id=added.id, detail="edited")
            )
        session.rollback()

    assert _stored(engine, added.id) == before


def test_save_with_another_businesss_method_raises_and_leaves_the_row_unchanged(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    foreign = _method(other_client, "Cash")
    with Session(engine) as session:
        added = SqlExpenses(session, business).add(_expense(category, None))
        session.commit()
    assert added.id is not None
    before = _stored(engine, added.id)

    with Session(engine) as session:
        with pytest.raises(PaymentMethodUnavailable):
            SqlExpenses(session, business).save(_expense(category, foreign, id=added.id))
        session.rollback()

    assert _stored(engine, added.id) == before


def test_save_with_no_method_removes_it(client: TestClient, engine: Engine) -> None:
    category = _category_id(client)
    business = _business_id(engine, category)
    cash = _method(client, "Cash")
    with Session(engine) as session:
        added = SqlExpenses(session, business).add(_expense(category, cash))
        session.commit()
    assert added.id is not None

    with Session(engine) as session:
        saved = SqlExpenses(session, business).save(_expense(category, None, id=added.id))
        session.commit()

    assert saved.payment_method is None
    assert saved.payment_method_label is None
    assert _stored(engine, added.id)[0] is None


def test_a_write_is_never_answered_from_the_identity_map(
    client: TestClient, engine: Engine
) -> None:
    """The row is loaded as an entity in the session first; the guarded UPDATE that
    follows must still be what the returned expense and the next read show."""
    category = _category_id(client)
    business = _business_id(engine, category)
    cash = _method(client, "Cash")
    transfer = _method(client, "Transfer")
    with Session(engine) as session:
        added = SqlExpenses(session, business).add(_expense(category, cash))
        session.commit()
    assert added.id is not None

    with Session(engine) as session:
        loaded = session.get(ExpenseRow, added.id)
        assert loaded is not None
        assert loaded.payment_method_id == cash
        expenses = SqlExpenses(session, business)
        saved = expenses.save(_expense(category, transfer, id=added.id))
        assert saved.payment_method == PaymentMethodId(transfer)
        again = expenses.by_id(added.id)
        assert again is not None
        assert again.payment_method == PaymentMethodId(transfer)
        session.commit()
