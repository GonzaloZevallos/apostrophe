"""Migration 0029 stores a Phone country on every business (docs/adr/0082): every existing
business reads 'AR' after the real revisions from 0028, no value that existed changes (the
shared comparator), and the column is nullable with no default."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT
from tests.migrations.comparator import upgrade_and_compare, upgrade_to


def _engine_at_0028(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to(engine, "0028")
    with engine.begin() as connection:
        for business_id, name in ((1, "Uno"), (2, "Dos"), (3, "Tres")):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :n, 'en')"),
                {"b": business_id, "n": name},
            )
            connection.execute(
                text(
                    "INSERT INTO app_user (id, business_id, email, password_hash) "
                    "VALUES (:b, :b, :n || '@example.com', 'x')"
                ),
                {"b": business_id, "n": name.lower()},
            )
    return engine


def test_every_existing_business_reads_ar_after_the_upgrade(tmp_path: Path) -> None:
    engine = _engine_at_0028(tmp_path)

    upgrade_and_compare(engine, "0029")

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT id, default_phone_country FROM business ORDER BY id")
        ).all()
    assert [tuple(row) for row in rows] == [(1, "AR"), (2, "AR"), (3, "AR")]
    engine.dispose()


def test_the_comparator_finds_no_changed_value_in_an_existing_column(tmp_path: Path) -> None:
    engine = _engine_at_0028(tmp_path)

    after = upgrade_and_compare(engine, "0029")

    assert {row["name"] for row in after["business"].values()} == {"Uno", "Dos", "Tres"}
    assert len(after["app_user"]) == 3
    engine.dispose()


def test_the_column_is_nullable_two_letters_and_keeps_no_default(tmp_path: Path) -> None:
    engine = _engine_at_0028(tmp_path)
    upgrade_to(engine, "0029")

    column = next(
        c for c in inspect(engine).get_columns("business") if c["name"] == "default_phone_country"
    )
    assert column["nullable"] is True
    assert column["default"] is None
    assert getattr(column["type"], "length", None) == 2
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (name, language) VALUES ('Nuevo', 'en')"))
        stored = connection.execute(
            text("SELECT default_phone_country FROM business WHERE name = 'Nuevo'")
        ).scalar_one()
    assert stored is None
    engine.dispose()


def test_the_downgrade_drops_the_column_and_keeps_every_business(tmp_path: Path) -> None:
    engine = _engine_at_0028(tmp_path)
    upgrade_to(engine, "0029")

    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.downgrade(config, "0028")

    assert "default_phone_country" not in {
        c["name"] for c in inspect(engine).get_columns("business")
    }
    with engine.connect() as connection:
        names = connection.execute(text("SELECT name FROM business ORDER BY id")).scalars().all()
    assert names == ["Uno", "Dos", "Tres"]
    engine.dispose()
