"""`SqlPayments.insert_later`'s own guard, over real SQLite (CODING_STANDARDS section
5, ADR-0012): the plan's invariant that recording a later payment refuses above the
balance in the domain first, then through one guarded `INSERT … SELECT`, never a read
followed by an unconditional insert — and that the guard's own figure, worked out in
SQL, equals `settle()`'s balance.

A customer and their sales come from the `client` fixture over HTTP; only
`SqlPayments.insert_later`, the seam under test, is built and called directly, the
same way `tests/sales/test_sql_sales.py` calls `SqlSales` directly over rows it seeded
through the API.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payments.adapters.sql_payments import SqlPayments
from app.payments.adapters.tables import PaymentRow
from app.payments.domain.payment import PaymentAboveBalance
from app.payments.domain.settlement import PaymentMethod

RECORDED_AT = datetime(2026, 9, 28, 12, 0, tzinfo=UTC)


def _business_id_of_customer(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        return row.business_id


def _seed(client: TestClient) -> int:
    """One customer with every shape the guard's sums must handle: a two-line sale
    with shipping, left owing; a cash sale; a sale recorded with no customer and
    assigned later; a $0 gift sale; a partial later payment."""
    variety = client.post("/varieties", json={"name": "Guard variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 1_000},
    )
    customer = client.post(
        "/customers", json={"name": "Guard customer", "phone": "11 2222-3333"}
    ).json()
    customer_id: int = customer["id"]

    client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
            "shipping_charged": 500,
            "lines": [
                {"variety_id": variety["id"], "grams": "10"},
                {"variety_id": variety["id"], "grams": "5"},
            ],
        },
    )
    client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "cash",
            "lines": [{"variety_id": variety["id"], "grams": "2"}],
        },
    )
    unassigned = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety["id"], "grams": "1"}]},
    ).json()
    assigned = client.put(
        f"/sales/{unassigned['id']}/customer", json={"customer_id": customer_id}
    )
    assert assigned.status_code == 200, assigned.text
    client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "lines": [{"variety_id": variety["id"], "grams": "3", "gift": True}],
        },
    )

    account = client.get(f"/customers/{customer_id}/account").json()
    balance = account["balance"]
    partial = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": min(1_000, balance), "method": "cash"},
    )
    assert partial.status_code == 201, partial.text

    return customer_id


def _balance(client: TestClient, customer_id: int) -> int:
    account = client.get(f"/customers/{customer_id}/account").json()
    balance: int = account["balance"]
    return balance


def _payment_count(engine: Engine, business_id: int) -> int:
    with Session(engine) as session:
        count = session.scalar(
            select(func.count())
            .select_from(PaymentRow)
            .where(PaymentRow.business_id == business_id)
        )
        assert count is not None
        return count


def test_insert_later_refuses_one_above_the_balance_and_adds_no_row(
    client: TestClient, engine: Engine
) -> None:
    customer_id = _seed(client)
    business_id = _business_id_of_customer(engine, customer_id)
    balance = _balance(client, customer_id)
    assert balance > 0, "the seeded ledger leaves this customer owing"

    before = _payment_count(engine, business_id)
    with Session(engine) as session:
        payments = SqlPayments(session, business_id)
        try:
            payments.insert_later(
                customer_id, RECORDED_AT.date(), balance + 1, PaymentMethod.CASH, RECORDED_AT
            )
            raised = False
        except PaymentAboveBalance:
            raised = True
        session.rollback()

    assert raised, "an amount one above the balance must be refused"
    assert _payment_count(engine, business_id) == before


def test_insert_later_accepts_exactly_the_balance(client: TestClient, engine: Engine) -> None:
    """The guard's own figure, worked out in SQL, equals `settle()`'s balance (the
    plan's invariant): proven here by accepting exactly that balance, not a penny
    more — the negative case above, not only this positive one."""
    customer_id = _seed(client)
    business_id = _business_id_of_customer(engine, customer_id)
    balance = _balance(client, customer_id)

    with Session(engine) as session:
        payments = SqlPayments(session, business_id)
        payments.insert_later(
            customer_id, RECORDED_AT.date(), balance, PaymentMethod.CASH, RECORDED_AT
        )
        session.commit()

    assert _balance(client, customer_id) == 0


def test_a_stale_read_is_refused_by_the_second_insert(client: TestClient, engine: Engine) -> None:
    """Two inserts against the same stale balance: the first spends it, so the second
    — built from a balance read before either ran — must still be refused. This is
    what makes the guard a single statement rather than a read followed by an
    unconditional insert: the check happens at insert time, against the row as it
    stands then, not against a figure read earlier."""
    customer_id = _seed(client)
    business_id = _business_id_of_customer(engine, customer_id)
    stale_balance = _balance(client, customer_id)
    assert stale_balance > 0

    with Session(engine) as session:
        payments = SqlPayments(session, business_id)
        payments.insert_later(
            customer_id, RECORDED_AT.date(), stale_balance, PaymentMethod.CASH, RECORDED_AT
        )
        session.commit()

    with Session(engine) as session:
        payments = SqlPayments(session, business_id)
        try:
            payments.insert_later(
                customer_id,
                RECORDED_AT.date(),
                stale_balance,
                PaymentMethod.CASH,
                RECORDED_AT,
            )
            refused = False
        except PaymentAboveBalance:
            refused = True
        session.rollback()

    assert refused, "the stale amount must be refused once the first insert has spent it"
