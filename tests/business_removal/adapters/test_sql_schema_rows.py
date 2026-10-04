"""`SqlSchemaRows`, the `SchemaRows` port over SQLAlchemy, over a file-backed SQLite
database with two businesses seeded through the real API: one of everything for the
business being removed, so the delete this subtask builds (no file, no CLI yet) can be
proven to reach every table the schema holds and nothing of the other business.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.invitations import invite_partner
from app.business_removal.adapters.sql_schema_rows import SqlSchemaRows
from app.business_removal.domain.classification import delete_order, owned_tables
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, PASSWORD, TEST_HASHER, MovableClock, open_business, signed_in
from tests.fakes.telegram import FakeTelegram

SETTINGS = Settings(secret_key="removal-test-secret", database_url="sqlite://")


def _seed_everything(client: TestClient, owner_email: str) -> dict[str, int]:
    """One of every record kind a business can hold (mirrors
    `tests/test_business_isolation.py`'s seeders), plus a failed login attempt. The
    leaving business's pending, used and expired join invitations are seeded
    separately, by `_seed_join_invitations`, since they need the business id and a
    session rather than the signed-in client alone."""
    variety = client.post("/varieties", json={"name": "Removal variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    customer = client.post(
        "/customers", json={"name": "Removal customer", "phone": "11 2345-6789"}
    ).json()
    category = client.post("/expense-categories", json={"name": "Removal category"}).json()
    client.post(
        "/expenses",
        json={
            "spent_on": "2026-10-02",
            "category_id": category["id"],
            "amount": 1_000,
            "detail": "Removal expense",
        },
    )
    entry = client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    ).json()
    client.put(f"/stock/varieties/{variety['id']}/threshold", json={"grams": "5"})
    client.put(
        f"/catalog/varieties/{variety['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": "removal"},
    )
    client.put("/catalog/header-footer", json={"header": "removal", "footer": "removal"})
    cash_sale = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety["id"], "grams": "5"}]},
    ).json()
    client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer["id"],
            "lines": [{"variety_id": variety["id"], "grams": "5"}],
        },
    )
    client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": "2026-09-20", "amount": 1_000, "method": "cash"},
    )
    # A failed login against the business's own user: `login_guard` is keyed by email,
    # so this is the row the removal must take along with that user (round-3 Q3's
    # "the removed users' emails' login-attempt history").
    client.post("/auth/login", json={"email": owner_email, "password": "wrong password"})
    return {"variety_id": variety["id"], "stock_entry_id": entry["id"], "sale_id": cash_sale["id"]}


@pytest.fixture
def file_engine(tmp_path: Path) -> Engine:
    return make_engine(f"sqlite:///{tmp_path / 'removal.db'}")


@pytest.fixture
def app(file_engine: Engine) -> FastAPI:
    return create_app(
        SETTINGS,
        engine=file_engine,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )


@pytest.fixture
def leaving_token(app: FastAPI, file_engine: Engine) -> str:
    clock = MovableClock(NOW)
    with TestClient(app) as client:
        return open_business(client, file_engine, clock, "Leaving Business", "leaving@example.com")


@pytest.fixture
def staying_token(app: FastAPI, file_engine: Engine, leaving_token: str) -> str:
    clock = MovableClock(NOW)
    with TestClient(app) as client:
        return open_business(client, file_engine, clock, "Staying Business", "staying@example.com")


def _issue_join_invitation(engine: Engine, business_id: int, now: datetime) -> str:
    """Issues a join invitation the way `POST /invitations` does, but lets the test
    pick `now` directly so an expired one needs no clock to move."""
    with Session(engine) as session:
        issued = invite_partner(
            SqlAccounts(session), session, business_id=business_id, now=now
        )
        session.commit()
    return issued.token


def _seed_join_invitations(client: TestClient, engine: Engine, business_id: int) -> None:
    """A pending, a used and an expired join invitation for one business (round-3
    Q1's three statuses), so the delete is proven to sweep all of them, whatever their
    status."""
    _issue_join_invitation(engine, business_id, NOW)  # left pending, never accepted.

    used_token = _issue_join_invitation(engine, business_id, NOW)
    accepted = client.post(
        f"/invitations/{used_token}/accept",
        json={"email": "partner@example.com", "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text

    # Issued well before its 7-day lifetime, so it is already expired as of NOW,
    # without moving any clock.
    _issue_join_invitation(engine, business_id, NOW - timedelta(days=30))


@pytest.fixture
def seeded(
    app: FastAPI, file_engine: Engine, leaving_token: str, staying_token: str
) -> dict[str, Any]:
    with TestClient(app) as client:
        leaving = signed_in(client, leaving_token)
        leaving_records = _seed_everything(leaving, "leaving@example.com")
        leaving_business_id = _business_id(file_engine, "leaving@example.com")
        _seed_join_invitations(leaving, file_engine, leaving_business_id)

        staying = signed_in(client, staying_token)
        staying_records = _seed_everything(staying, "staying@example.com")
    return {"leaving": leaving_records, "staying": staying_records}


def _business_id(engine: Engine, email: str) -> int:
    with Session(engine) as session:
        row = session.execute(
            text("SELECT business_id FROM app_user WHERE email = :email"), {"email": email}
        ).first()
    assert row is not None
    return int(row[0])


def _table_counts(engine: Engine, table_names: list[str]) -> dict[str, int]:
    with engine.connect() as connection:
        return {
            name: connection.execute(text(f"SELECT COUNT(*) FROM {name}")).scalar_one()
            for name in table_names
        }


def test_business_of_finds_the_business_from_any_of_its_users_emails(
    file_engine: Engine, leaving_token: str
) -> None:
    with Session(file_engine) as session:
        ref = SqlSchemaRows(session).business_of("  LEAVING@Example.com  ")

    assert ref is not None
    assert ref.name == "Leaving Business"


def test_business_of_answers_none_for_an_unknown_email(
    file_engine: Engine, leaving_token: str
) -> None:
    with Session(file_engine) as session:
        assert SqlSchemaRows(session).business_of("nobody@example.com") is None


def _counts_for_business(
    engine: Engine, table_names: list[str], business_id: int
) -> dict[str, int]:
    with engine.connect() as connection:
        counts = {}
        for name in table_names:
            filter_sql = "id" if name == "business" else "business_id"
            counts[name] = connection.execute(
                text(f"SELECT COUNT(*) FROM {name} WHERE {filter_sql} = :bid"),
                {"bid": business_id},
            ).scalar_one()
        return counts


def test_delete_business_empties_every_owned_table_and_leaves_the_other_business_whole(
    app: FastAPI, file_engine: Engine, staying_token: str, seeded: dict[str, Any]
) -> None:
    staying_id = _business_id(file_engine, "staying@example.com")
    with Session(file_engine) as session:
        rows = SqlSchemaRows(session)
        schema = rows.schema()
        business = rows.business_of("leaving@example.com")
        assert business is not None
        order = delete_order(schema)
        exported_table_names = sorted(
            table.name for table in owned_tables(schema) if table.name != "invitation"
        )

        before = _table_counts(file_engine, [*exported_table_names, "invitation", "login_guard"])
        staying_before = _counts_for_business(file_engine, exported_table_names, staying_id)

        deleted = rows.delete_business(business.id, order)
        session.commit()

    assert deleted.invitation_count >= 1
    assert deleted.login_guard_count == 1
    for name in exported_table_names:
        assert deleted.tables[name] or name == "business"

    after = _table_counts(file_engine, [*exported_table_names, "invitation", "login_guard"])
    staying_after = _counts_for_business(file_engine, exported_table_names, staying_id)

    for name in exported_table_names:
        # Every row deleted belonged to the leaving business; the staying business's
        # rows of the same table are exactly what is left (criterion 6: untouched).
        assert before[name] - after[name] == len(deleted.tables[name])
    assert before["invitation"] - after["invitation"] == deleted.invitation_count
    assert before["login_guard"] - after["login_guard"] == deleted.login_guard_count
    # The staying business's own rows, counted by its own id, are untouched exactly.
    assert staying_before == staying_after
    assert staying_after["app_user"] >= 1
    # And none of what's left still carries the removed business's id.
    with file_engine.connect() as connection:
        for name in exported_table_names:
            filter_sql = "id" if name == "business" else "business_id"
            remaining = connection.execute(
                text(f"SELECT COUNT(*) FROM {name} WHERE {filter_sql} = :bid"),
                {"bid": business.id},
            ).scalar_one()
            assert remaining == 0, f"{name} still has rows of the removed business"
        invitations_left = connection.execute(
            text("SELECT COUNT(*) FROM invitation WHERE business_id = :bid"),
            {"bid": business.id},
        ).scalar_one()
        assert invitations_left == 0
        # The removed business's own failed-login row is gone; the staying
        # business's own failed-login row, keyed by a different email, is not.
        leaving_guard_left = connection.execute(
            text("SELECT COUNT(*) FROM login_guard WHERE email = :email"),
            {"email": "leaving@example.com"},
        ).scalar_one()
        assert leaving_guard_left == 0
        staying_guard_left = connection.execute(
            text("SELECT COUNT(*) FROM login_guard WHERE email = :email"),
            {"email": "staying@example.com"},
        ).scalar_one()
        assert staying_guard_left == 1

    # The staying business still reads all of its own data through the API
    # (criterion 6: "keep working during the run").
    with TestClient(app) as client:
        staying = signed_in(client, staying_token)
        varieties = staying.get("/varieties")
        assert varieties.status_code == 200
        assert [v["name"] for v in varieties.json()] == ["Removal variety"]
        customers = staying.get("/customers")
        assert customers.status_code == 200
        assert [c["name"] for c in customers.json()] == ["Removal customer"]
        sales = staying.get("/sales")
        assert sales.status_code == 200
        assert len(sales.json()) == 2


def test_rows_reads_every_recorded_field_sorted_by_id(
    file_engine: Engine, seeded: dict[str, Any]
) -> None:
    with Session(file_engine) as session:
        rows = SqlSchemaRows(session)
        business = rows.business_of("leaving@example.com")
        assert business is not None
        varieties = rows.rows("variety", business.id)

    assert len(varieties) == 1
    assert varieties[0]["name"] == "Removal variety"
    ids = [cast(int, row["id"]) for row in varieties]
    assert ids == sorted(ids)


def test_a_table_added_after_migrating_is_found_ordered_and_emptied(
    file_engine: Engine, seeded: dict[str, Any]
) -> None:
    with file_engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE later_table ("
                "id INTEGER PRIMARY KEY, "
                "business_id INTEGER NOT NULL REFERENCES business(id), "
                "variety_id INTEGER NOT NULL REFERENCES variety(id), "
                "note TEXT NOT NULL)"
            )
        )

    with Session(file_engine) as session:
        rows = SqlSchemaRows(session)
        business = rows.business_of("leaving@example.com")
        assert business is not None
        variety_id = rows.rows("variety", business.id)[0]["id"]
        session.execute(
            text(
                "INSERT INTO later_table (business_id, variety_id, note) "
                "VALUES (:business_id, :variety_id, 'later')"
            ),
            {"business_id": business.id, "variety_id": variety_id},
        )
        session.commit()

    with Session(file_engine) as session:
        rows = SqlSchemaRows(session)
        schema = rows.schema()
        business = rows.business_of("leaving@example.com")
        assert business is not None
        order = delete_order(schema)

        assert "later_table" in order
        assert order.index("later_table") < order.index("variety")

        later_rows = rows.rows("later_table", business.id)
        assert len(later_rows) == 1

        deleted = rows.delete_business(business.id, order)
        session.commit()

    assert deleted.tables["later_table"] == {later_rows[0]["id"]}
    with file_engine.connect() as connection:
        remaining = connection.execute(
            text("SELECT COUNT(*) FROM later_table")
        ).scalar_one()
    assert remaining == 0


def test_rows_parses_bool_date_and_naive_datetime_columns(tmp_path: Path) -> None:
    """`rows()` reflects the live schema rather than any app-side `TypeDecorator`
    (`SqlSchemaRows`'s own module docstring), so a boolean column must come back as a
    Python `bool`, a date column as a `datetime.date`, and an instant column as a naive
    `datetime` (`tzinfo is None`) — the offset `UtcDateTime` drops on the way in
    (`app/db.py`) never resurfaces through plain reflection. A frozen clock on a fresh
    app gives exact, known values instead of "whatever today happens to be"."""
    engine = make_engine(f"sqlite:///{tmp_path / 'types.db'}")
    app = create_app(
        SETTINGS,
        engine=engine,
        clock=MovableClock(NOW),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        token = open_business(
            client, engine, MovableClock(NOW), "Types Business", "types@example.com"
        )
        signed = signed_in(client, token)
        customer = signed.post(
            "/customers", json={"name": "Vip customer", "phone": "11 2345-6789", "vip": True}
        ).json()
        variety = signed.post("/varieties", json={"name": "Types variety"}).json()
        entry = signed.post(
            "/stock/entries",
            json={
                "date": "2026-01-01",
                "variety_id": variety["id"],
                "origin": "opening_stock",
                "grams": "50",
            },
        ).json()

    with Session(engine) as session:
        rows = SqlSchemaRows(session)
        business = rows.business_of("types@example.com")
        assert business is not None

        [customer_row] = rows.rows("customer", business.id)
        assert customer_row["id"] == customer["id"]
        assert type(customer_row["vip"]) is bool
        assert customer_row["vip"] is True

        [entry_row] = rows.rows("stock_entry", business.id)
        assert entry_row["id"] == entry["id"]
        assert type(entry_row["entry_date"]) is date
        assert entry_row["entry_date"] == date(2026, 1, 1)

        recorded_at = entry_row["recorded_at"]
        assert type(recorded_at) is datetime
        assert recorded_at.tzinfo is None
        assert recorded_at == NOW.replace(tzinfo=None)
