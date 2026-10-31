"""Migration 0020 stores a time zone on every business (docs/adr/0057): every existing
business reads Argentina's zone after the real `upgrade_to_head` from 0019, over both the
plain sqlite driver and sqlite+libsql (ADR-0016), and the shared M3 comparator proves no
value of any column that existed before changed."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head
from tests.migrations.m3 import assert_no_value_changed, snapshot

NOW = "2026-01-01 12:00:00"
ARGENTINA = "America/Argentina/Buenos_Aires"


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def _seed(engine: Engine) -> None:
    """Two businesses, each with a user, an invitation, a variety and a sale with a line."""
    with engine.begin() as connection:
        for business_id, name in ((1, "Uno"), (2, "Dos")):
            params = {"b": business_id, "name": name, "now": NOW}
            statements = (
                "INSERT INTO business (id, name, language) VALUES (:b, :name, 'es')",
                "INSERT INTO app_user (id, business_id, email, password_hash) "
                "VALUES (:b, :b, :name || '@example.com', 'x')",
                "INSERT INTO invitation (id, kind, token_digest, business_id, created_at) "
                "VALUES (:b, 'join', 'digest' || :b, :b, :now)",
                "INSERT INTO variety (id, business_id, name, name_key) "
                "VALUES (:b, :b, 'Lavanda', 'lavanda')",
                "INSERT INTO sale (id, business_id, sale_date, shipping_charged, recorded_at) "
                "VALUES (:b, :b, '2026-01-01', 0, :now)",
                "INSERT INTO sale_line (id, business_id, sale_id, variety_id, grams_hundredths, "
                "pricing_rule, price_per_gram, line_total, position) "
                "VALUES (:b, :b, :b, :b, 500, 'list', 100, 500, 1)",
            )
            for statement in statements:
                connection.execute(text(statement), params)


def _assert_migrated_whole(engine: Engine) -> None:
    with Session(engine) as session:
        zones = session.execute(text("SELECT id, time_zone FROM business ORDER BY id")).all()
        assert [(row.id, row.time_zone) for row in zones] == [(1, ARGENTINA), (2, ARGENTINA)]
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        assert dbapi_connection.execute("PRAGMA foreign_key_check").fetchall() == []


def test_every_existing_business_reads_argentina_and_nothing_else_changes_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0019")
    _seed(engine)
    before = snapshot(engine)

    upgrade_to_head(engine)

    assert_no_value_changed(before, snapshot(engine))
    _assert_migrated_whole(engine)
    engine.dispose()


def test_every_existing_business_reads_argentina_and_nothing_else_changes_on_libsql(
    tmp_path: Path,
) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0019")
    _seed(engine)
    before = snapshot(engine)

    upgrade_to_head(engine)

    assert_no_value_changed(before, snapshot(engine))
    _assert_migrated_whole(engine)
    engine.dispose()


def test_the_time_zone_column_is_not_null_and_defaults_to_argentina(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)

    column = next(c for c in inspect(engine).get_columns("business") if c["name"] == "time_zone")
    assert column["nullable"] is False
    assert ARGENTINA in str(column["default"])
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (name, language) VALUES ('Nuevo', 'en')"))
    with Session(engine) as session:
        stored = session.execute(text("SELECT time_zone FROM business")).scalar_one()
    assert stored == ARGENTINA
    engine.dispose()
