"""Migration 0019 stores a language on every business (docs/adr/0050): every existing row
reads `'en'` after the real `upgrade_to_head` from 0018, over both the plain sqlite driver
and sqlite+libsql (ADR-0016), no child row is orphaned, and the column keeps no default."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

NOW = "2026-01-01 12:00:00"


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
                "INSERT INTO business (id, name) VALUES (:b, :name)",
                "INSERT INTO app_user (id, business_id, email, password_hash) "
                "VALUES (:b, :b, :name || '@example.com', 'x')",
                "INSERT INTO invitation (id, kind, token_digest, business_id, created_at) "
                "VALUES (:b, 'join', 'digest' || :b, :b, :now)",
                "INSERT INTO variety (id, business_id, name, name_key) "
                "VALUES (:b, :b, 'Lavanda', 'lavanda')",
                "INSERT INTO sale (id, business_id, sale_date, shipping_charged, recorded_at) "
                "VALUES (:b, :b, '2026-01-01', 0, :now)",
            )
            for statement in statements:
                connection.execute(text(statement), params)


def _assert_migrated_whole(engine: Engine) -> None:
    with Session(engine) as session:
        languages = session.execute(text("SELECT id, language FROM business ORDER BY id")).all()
        assert [(row.id, row.language) for row in languages] == [(1, "en"), (2, "en")]
        for child in ("app_user", "invitation", "variety", "sale"):
            joined = session.execute(
                text(
                    f"SELECT {child}.id FROM {child} "  # noqa: S608 - fixed table names
                    f"JOIN business ON business.id = {child}.business_id"
                )
            ).all()
            assert len(joined) == 2, child
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        assert dbapi_connection.execute("PRAGMA foreign_key_check").fetchall() == []


def test_every_existing_business_reads_en_after_the_upgrade_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0018")
    _seed(engine)

    upgrade_to_head(engine)

    _assert_migrated_whole(engine)
    engine.dispose()


def test_every_existing_business_reads_en_after_the_upgrade_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0018")
    _seed(engine)

    upgrade_to_head(engine)

    _assert_migrated_whole(engine)
    engine.dispose()


def test_the_language_column_is_not_null_and_keeps_no_server_default(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)

    column = next(c for c in inspect(engine).get_columns("business") if c["name"] == "language")
    assert column["nullable"] is False
    assert column["default"] is None
    with pytest.raises(Exception, match="NOT NULL"), engine.begin() as connection:
        connection.execute(text("INSERT INTO business (name) VALUES ('Sin idioma')"))
    engine.dispose()
