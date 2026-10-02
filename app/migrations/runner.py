"""Brings a database to the latest schema. The app runs it at startup.

One connection for the whole upgrade: for an in-memory database the app's tables and
the migrated tables are the same database only because they share that connection.
Foreign keys are switched off while revisions run, because SQLite alters a table by
copying it (batch mode) and the copy would trip them; they are checked once at the end.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import Connection, Engine

MIGRATIONS_ROOT = Path(__file__).resolve().parent


class MigrationLeftBrokenReferences(RuntimeError):
    pass


def upgrade_to_head(engine: Engine) -> None:
    with engine.connect() as connection:
        sqlite = connection.dialect.name == "sqlite"
        if sqlite:
            _pragma(connection, "foreign_keys=OFF")
        try:
            with connection.begin():
                command.upgrade(_config(connection), "head")
            if sqlite:
                _check_foreign_keys(connection)
        finally:
            if sqlite:
                _pragma(connection, "foreign_keys=ON")


def _config(connection: Connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_ROOT))
    config.attributes["connection"] = connection
    return config


def _pragma(connection: Connection, setting: str) -> None:
    # On the raw DBAPI connection: through SQLAlchemy the statement would open a
    # transaction, and SQLite ignores this pragma inside one.
    dbapi_connection = connection.connection.dbapi_connection
    assert dbapi_connection is not None
    dbapi_connection.execute(f"PRAGMA {setting}")


def _check_foreign_keys(connection: Connection) -> None:
    dbapi_connection = connection.connection.dbapi_connection
    assert dbapi_connection is not None
    broken = dbapi_connection.execute("PRAGMA foreign_key_check").fetchone()
    if broken is not None:
        raise MigrationLeftBrokenReferences(f"{broken[0]} row {broken[1]}")
