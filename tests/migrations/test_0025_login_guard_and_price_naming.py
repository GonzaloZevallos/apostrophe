"""Migration 0025 (CODING_STANDARDS §11, docs/adr/0077): the guard tables get a surrogate
`id`, `locked_until` / `window_start` / `effective_from` become `unlocks_at` /
`window_started_at` / `effective_on`, and the customer phone constraint takes its
convention name. Run through the real revisions on a seeded file database: every row
survives under its new name, the guard brake answers and counts as before, no old name
is left anywhere in the schema, and the walk down restores the 0024 schema exactly."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.domain.account import Email
from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT
from tests.conftest import NOW
from tests.migrations.comparator import upgrade_to

LOCKED_EMAIL = "locked@example.com"
PLAIN_EMAIL = "plain@example.com"
EXPIRED_DIGEST = "a" * 64
ACTIVE_DIGEST = "b" * 64

EMAIL_LOCK_UNTIL = "2026-10-02 18:10:00.000000"
EXPIRED_WINDOW = "2026-10-02 17:00:00.000000"
ACTIVE_WINDOW = "2026-10-02 17:50:00.000000"
ADDRESS_LOCK_UNTIL = "2026-10-02 18:20:00.000000"

OLD_TOKENS = ("locked_until", "window_start", "effective_from", "uq_customer_business_phone")
SEEDED_TABLES = ("login_guard", "login_address_guard", "price_entry", "customer")


def _migrate(engine: Engine, direction: str, revision: str) -> None:
    """As the runner does: foreign keys off while a table is rebuilt, checked after."""
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        raw = connection.connection.dbapi_connection
        assert raw is not None
        raw.execute("PRAGMA foreign_keys=OFF")
        with connection.begin():
            if direction == "up":
                command.upgrade(config, revision)
            else:
                command.downgrade(config, revision)
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
        raw.execute("PRAGMA foreign_keys=ON")


def _seed(engine: Engine) -> None:
    """At 0024, with the 0024 names."""
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (1, 'Uno', 'en')")
        )
        connection.execute(
            text(
                "INSERT INTO variety (id, business_id, name, name_key) "
                "VALUES (1, 1, 'Lavanda', 'lavanda')"
            )
        )
        for entry_id, day, price in ((1, "2026-01-01", 100), (2, "2026-02-01", 200)):
            connection.execute(
                text(
                    "INSERT INTO price_entry (id, business_id, variety_id, effective_from, "
                    "list_price) VALUES (:id, 1, 1, :day, :price)"
                ),
                {"id": entry_id, "day": day, "price": price},
            )
        for customer_id, name, phone in ((1, "Con Telefono", "+5491123456789"), (2, "Sin", None)):
            connection.execute(
                text(
                    "INSERT INTO customer (id, business_id, name, phone, vip) "
                    "VALUES (:id, 1, :name, :phone, 0)"
                ),
                {"id": customer_id, "name": name, "phone": phone},
            )
        for email, failures, until in ((LOCKED_EMAIL, 2, EMAIL_LOCK_UNTIL), (PLAIN_EMAIL, 3, None)):
            connection.execute(
                text(
                    "INSERT INTO login_guard (email, failures, locked_until) "
                    "VALUES (:email, :failures, :until)"
                ),
                {"email": email, "failures": failures, "until": until},
            )
        for digest, failures, window, until in (
            (EXPIRED_DIGEST, 4, EXPIRED_WINDOW, None),
            (ACTIVE_DIGEST, 2, ACTIVE_WINDOW, ADDRESS_LOCK_UNTIL),
        ):
            connection.execute(
                text(
                    "INSERT INTO login_address_guard "
                    "(address_digest, failures, window_start, locked_until) "
                    "VALUES (:digest, :failures, :window, :until)"
                ),
                {"digest": digest, "failures": failures, "window": window, "until": until},
            )


def _rows(engine: Engine, sql: str) -> set[tuple[Any, ...]]:
    with engine.connect() as connection:
        return {tuple(row) for row in connection.execute(text(sql))}


def _count(engine: Engine, table: str) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one())


@pytest.fixture
def at_0024(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'before.db'}")
    upgrade_to(engine, "0024")
    _seed(engine)
    return engine


@pytest.fixture
def at_0025(at_0024: Engine) -> Engine:
    _migrate(at_0024, "up", "0025")
    return at_0024


def test_every_row_survives_under_its_new_names(at_0024: Engine) -> None:
    counts = {table: _count(at_0024, table) for table in SEEDED_TABLES}
    assert counts == {
        "login_guard": 2,
        "login_address_guard": 2,
        "price_entry": 2,
        "customer": 2,
    }

    _migrate(at_0024, "up", "0025")

    assert {table: _count(at_0024, table) for table in SEEDED_TABLES} == counts
    assert _rows(at_0024, "SELECT email, failures, unlocks_at FROM login_guard") == {
        (LOCKED_EMAIL, 2, EMAIL_LOCK_UNTIL),
        (PLAIN_EMAIL, 3, None),
    }
    assert _rows(
        at_0024,
        "SELECT address_digest, failures, window_started_at, unlocks_at FROM login_address_guard",
    ) == {
        (EXPIRED_DIGEST, 4, EXPIRED_WINDOW, None),
        (ACTIVE_DIGEST, 2, ACTIVE_WINDOW, ADDRESS_LOCK_UNTIL),
    }
    assert _rows(at_0024, "SELECT id, effective_on, list_price FROM price_entry") == {
        (1, "2026-01-01", 100),
        (2, "2026-02-01", 200),
    }
    assert _rows(at_0024, "SELECT id, name, phone FROM customer") == {
        (1, "Con Telefono", "+5491123456789"),
        (2, "Sin", None),
    }


def test_the_guard_ids_are_distinct_and_cover_one_to_n(at_0025: Engine) -> None:
    for table in ("login_guard", "login_address_guard"):
        ids = sorted(row[0] for row in _rows(at_0025, f"SELECT id FROM {table}"))
        assert ids == [1, 2]


def test_login_locks_answers_as_the_seeded_rows_say(at_0025: Engine) -> None:
    with Session(at_0025) as session:
        accounts = SqlAccounts(session)

        locked = accounts.login_locks(Email(LOCKED_EMAIL), ACTIVE_DIGEST)
        plain = accounts.login_locks(Email(PLAIN_EMAIL), EXPIRED_DIGEST)
        unknown = accounts.login_locks(Email("nadie@example.com"), "c" * 64)

    assert locked.email_locked_until == datetime(2026, 10, 2, 18, 10, tzinfo=UTC)
    assert locked.address_locked_until == datetime(2026, 10, 2, 18, 20, tzinfo=UTC)
    assert plain.email_locked_until is None
    assert plain.address_locked_until is None
    assert (unknown.email_locked_until, unknown.address_locked_until) == (None, None)


def test_the_email_count_continues_the_stored_one(at_0025: Engine) -> None:
    with Session(at_0025) as session:
        accounts = SqlAccounts(session)

        assert accounts.count_email_failure(Email(PLAIN_EMAIL), NOW) == 4
        assert accounts.count_email_failure(Email(LOCKED_EMAIL), NOW) == 3
        assert accounts.count_email_failure(Email("nuevo@example.com"), NOW) == 1
        session.commit()

    assert _count(at_0025, "login_guard") == 3


def test_an_active_address_window_increments_and_an_expired_one_restarts(at_0025: Engine) -> None:
    cutoff = NOW - timedelta(minutes=15)
    with Session(at_0025) as session:
        accounts = SqlAccounts(session)

        assert accounts.count_address_failure(ACTIVE_DIGEST, NOW, cutoff) == 3
        assert accounts.count_address_failure(EXPIRED_DIGEST, NOW, cutoff) == 1
        session.commit()

    windows = dict(
        _rows(at_0025, "SELECT address_digest, window_started_at FROM login_address_guard")
    )
    assert windows[ACTIVE_DIGEST] == ACTIVE_WINDOW
    assert windows[EXPIRED_DIGEST].startswith("2026-10-02 18:00:00")


def test_a_second_row_for_one_email_or_address_is_refused(at_0025: Engine) -> None:
    with pytest.raises(IntegrityError, match="login_guard.email"):
        with at_0025.begin() as connection:
            connection.execute(
                text("INSERT INTO login_guard (email, failures) VALUES (:e, 1)"),
                {"e": LOCKED_EMAIL},
            )
    with pytest.raises(IntegrityError, match="login_address_guard.address_digest"):
        with at_0025.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO login_address_guard (address_digest, failures, window_started_at) "
                    "VALUES (:d, 1, :w)"
                ),
                {"d": ACTIVE_DIGEST, "w": ACTIVE_WINDOW},
            )


def test_no_reflected_name_carries_an_old_token(at_0025: Engine) -> None:
    inspector = inspect(at_0025)
    names: list[str] = []
    for table in inspector.get_table_names():
        names.append(table)
        names += [column["name"] for column in inspector.get_columns(table)]
        names += [str(index["name"]) for index in inspector.get_indexes(table)]
        names += [str(unique["name"]) for unique in inspector.get_unique_constraints(table)]
        names.append(str(inspector.get_pk_constraint(table)["name"]))
        names += [str(fk["name"]) for fk in inspector.get_foreign_keys(table)]

    # A whole token: `window_started_at` is the new name and merely starts like the old one.
    old = re.compile(rf"(?<![a-z])({'|'.join(OLD_TOKENS)})(?![a-z])")
    assert [name for name in names if old.search(name)] == []
    assert {"pk_login_guard", "uq_login_guard_email"} <= set(names)
    assert {"pk_login_address_guard", "uq_login_address_guard_address_digest"} <= set(names)
    assert {"uq_price_entry_variety_id_effective_on", "uq_customer_business_id_phone"} <= set(names)


def _shape(engine: Engine) -> dict[str, dict[str, Any]]:
    """Every table's columns in order, keys and indexes as SQLite reflects them."""
    inspector = inspect(engine)

    def by_name(items: list[Any]) -> list[Any]:
        return sorted(items, key=lambda item: str(item["name"]))

    return {
        table: {
            "columns": [
                (column["name"], str(column["type"]), column["nullable"], column["default"])
                for column in inspector.get_columns(table)
            ],
            "primary_key": inspector.get_pk_constraint(table),
            "uniques": by_name(inspector.get_unique_constraints(table)),
            "indexes": [
                {
                    **index,
                    "dialect_options": {
                        key: str(value) for key, value in index["dialect_options"].items()
                    },
                }
                for index in by_name(inspector.get_indexes(table))
            ],
            "foreign_keys": by_name(inspector.get_foreign_keys(table)),
        }
        for table in inspector.get_table_names()
    }


def test_the_walk_down_restores_the_0024_schema_and_rows_exactly(
    at_0024: Engine, tmp_path: Path
) -> None:
    straight = make_engine(f"sqlite:///{tmp_path / 'straight.db'}")
    upgrade_to(straight, "0024")
    _seed(straight)

    _migrate(at_0024, "up", "0025")
    _migrate(at_0024, "down", "0024")

    assert _shape(at_0024) == _shape(straight)
    for table in SEEDED_TABLES:
        assert _rows(at_0024, f"SELECT * FROM {table}") == _rows(straight, f"SELECT * FROM {table}")
    assert _rows(at_0024, "SELECT version_num FROM alembic_version") == {("0024",)}
