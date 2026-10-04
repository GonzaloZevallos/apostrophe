"""The libSQL dialect (ADR-0014, plan "Connect to Turso over sqlite+libsql"):
`make_engine` branches on the driver name, never `url.startswith` (plan invariant),
and the paths the app already relies on — migrations, the payments guard, an atomic
upsert with `RETURNING` — work unchanged on it.

No network: every engine here opens a local file through `sqlite+libsql://`, which is
what proves the dialect without reaching Turso (the brief's own bound; Hrana over the
network is the known risk the Tech Lead left open).
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.db import make_engine
from app.main import create_app
from app.migrations.runner import upgrade_to_head
from app.payments.adapters.sql_payments import SqlPayments
from app.payments.domain.payment import PaymentAboveBalance
from app.payments.domain.settlement import PaymentMethod
from app.settings import Settings
from app.tables import metadata
from tests.conftest import NOW, TEST_HASHER, MovableClock, open_business, signed_in


def _libsql_url(tmp_path: Path) -> str:
    return f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}"


# Overrides `tests/conftest.py`'s in-memory `engine` fixture, for this file only, with
# one that opens a local file through the libsql driver — the seam under test. `app`
# and `client` (defined in conftest) take whichever `engine` is in scope, so they are
# reused unchanged.
@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    engine = make_engine(_libsql_url(tmp_path))
    upgrade_to_head(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def app(engine: Engine) -> FastAPI:
    return create_app(
        Settings(secret_key="test-secret-key"),
        engine=engine,
        clock=MovableClock(NOW),
        hasher=TEST_HASHER,
    )


@pytest.fixture
def client(app: FastAPI, engine: Engine) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        token = open_business(
            test_client, engine, MovableClock(NOW), "Negocio libsql", "libsql@example.com"
        )
        yield signed_in(test_client, token)


def test_make_engine_passes_the_auth_token_as_a_connect_arg_never_the_url(
    tmp_path: Path,
) -> None:
    """The plan's invariant: the token reaches the driver through `connect_args`,
    never folded into `url`. A fake token still opens a *local* file — libsql does not
    check a token against a remote host it never dials — which is enough to prove the
    kwarg reaches the driver instead of SQLAlchemy choking on an unknown parameter."""
    url = _libsql_url(tmp_path)
    engine = make_engine(url, auth_token="not-a-real-token")
    try:
        with engine.connect() as connection:
            connection.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY)"))
        assert "not-a-real-token" not in str(engine.url)
    finally:
        engine.dispose()


def test_make_engine_refuses_no_differently_for_an_unparsable_driver_free_url() -> None:
    """Branching on `get_driver_name()` must not crash on a URL `make_url` can parse
    but that names no driver at all — the input the string-prefix check it replaces
    would have accepted by accident."""
    engine = make_engine("sqlite://")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    finally:
        engine.dispose()


def test_upgrade_to_head_on_a_libsql_local_file_matches_the_tables_the_code_declares(
    tmp_path: Path,
) -> None:
    engine = make_engine(_libsql_url(tmp_path))
    try:
        upgrade_to_head(engine)
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            assert compare_metadata(context, metadata) == []
    finally:
        engine.dispose()


def test_upgrading_twice_changes_nothing_on_libsql(tmp_path: Path) -> None:
    engine = make_engine(_libsql_url(tmp_path))
    try:
        upgrade_to_head(engine)
        upgrade_to_head(engine)
    finally:
        engine.dispose()


def _seed_customer_owing(client: TestClient) -> int:
    variety = client.post("/varieties", json={"name": "Guard variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 1_000},
    )
    customer = client.post(
        "/customers", json={"name": "Guard customer", "phone": "11 2222-3333"}
    ).json()
    customer_id: int = customer["id"]
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
            "lines": [{"variety_id": variety["id"], "grams": "10"}],
        },
    )
    assert sale.status_code == 201, sale.text
    return customer_id


@pytest.mark.xfail(
    strict=True,
    reason=(
        "sqlalchemy-libsql 0.2.0: CursorResult.lastrowid comes back None after a "
        "result-less `INSERT ... SELECT` on the libsql driver, though the DBAPI "
        "cursor's own .lastrowid is set correctly right after execution (confirmed "
        "directly against libsql_experimental, bypassing SQLAlchemy). "
        "SqlPayments.insert_later reads CursorResult.lastrowid and raises its own "
        "assertion as a result. This is a dialect limitation, not a bug in "
        "insert_later; reported to the Tech Lead (see 'For the Tech Lead') rather "
        "than worked around here, per the subtask's own instruction to stop and "
        "report when the dialect itself fails a declared seam."
    ),
)
def test_the_guarded_payment_insert_accepts_exactly_the_balance_on_libsql(
    client: TestClient, engine: Engine
) -> None:
    customer_id = _seed_customer_owing(client)
    balance = client.get(f"/customers/{customer_id}/account").json()["balance"]
    assert balance > 0

    with Session(engine) as session:
        row = session.get(CustomerRow, customer_id)
        assert row is not None
        payments = SqlPayments(session, row.business_id)
        payments.insert_later(customer_id, NOW.date(), balance, PaymentMethod.CASH, NOW)
        session.commit()

    assert client.get(f"/customers/{customer_id}/account").json()["balance"] == 0


def test_the_guarded_payment_insert_refuses_one_above_the_balance_on_libsql(
    client: TestClient, engine: Engine
) -> None:
    customer_id = _seed_customer_owing(client)
    balance = client.get(f"/customers/{customer_id}/account").json()["balance"]
    assert balance > 0

    with Session(engine) as session:
        row = session.get(CustomerRow, customer_id)
        assert row is not None
        payments = SqlPayments(session, row.business_id)
        with pytest.raises(PaymentAboveBalance):
            payments.insert_later(customer_id, NOW.date(), balance + 1, PaymentMethod.CASH, NOW)
        session.rollback()

    assert client.get(f"/customers/{customer_id}/account").json()["balance"] == balance


def test_an_upsert_with_returning_works_on_login_guard_on_libsql(engine: Engine) -> None:
    """The brake's own shape (plan: "a brake counter changes only through one atomic
    SQL statement with RETURNING"): proved here against the libsql driver directly,
    ahead of the login-brakes subtask that writes it for real."""
    upsert = text(
        """
        INSERT INTO login_guard (email, failures, locked_until)
        VALUES (:email, 1, NULL)
        ON CONFLICT(email) DO UPDATE SET failures = login_guard.failures + 1
        RETURNING failures
        """
    )
    with Session(engine) as session:
        first = session.execute(upsert, {"email": "guard@example.com"}).scalar_one()
        session.commit()
    with Session(engine) as session:
        second = session.execute(upsert, {"email": "guard@example.com"}).scalar_one()
        session.commit()

    assert (first, second) == (1, 2)
