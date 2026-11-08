"""The shared migration comparator (plan invariant: a migration changes no value of a column
that existed before it).

`snapshot` reads every table of a database, each row keyed by its primary key; `compare`
raises `AssertionError` unless every table that existed still has its row count, its keys
and, for every column that existed, each row's value. A new table, a new column and a new
row are allowed in a table nobody compared; it checks values, not constraints.
"""

from __future__ import annotations

from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.migrations.runner import MIGRATIONS_ROOT

Row = dict[str, Any]
Snapshot = dict[str, dict[tuple[Any, ...], Row]]


def upgrade_to(engine: Engine, revision: str) -> None:
    """Runs the real revisions up to `revision` over one connection."""
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def snapshot(engine: Engine) -> Snapshot:
    inspector = inspect(engine)
    taken: Snapshot = {}
    with engine.connect() as connection:
        for table in inspector.get_table_names():
            if table == "alembic_version":
                continue
            columns = [column["name"] for column in inspector.get_columns(table)]
            primary = inspector.get_pk_constraint(table)["constrained_columns"] or columns
            rows = connection.execute(text(f'SELECT * FROM "{table}"')).mappings().all()
            taken[table] = {tuple(row[name] for name in primary): dict(row) for row in rows}
    return taken


def compare(before: Snapshot, after: Snapshot) -> None:
    for table, old_rows in before.items():
        if table not in after:
            raise AssertionError(f"table {table!r} is gone")
        new_rows = after[table]
        if len(new_rows) != len(old_rows):
            raise AssertionError(
                f"table {table!r} had {len(old_rows)} rows, it has {len(new_rows)}"
            )
        for row_id, old in old_rows.items():
            if row_id not in new_rows:
                raise AssertionError(f"table {table!r} lost the row {row_id}")
            new = new_rows[row_id]
            for column, value in old.items():
                if column not in new:
                    raise AssertionError(f"table {table!r} lost the column {column!r}")
                if new[column] != value:
                    raise AssertionError(
                        f"table {table!r} row {row_id} column {column!r} "
                        f"was {value!r}, it is {new[column]!r}"
                    )


def upgrade_and_compare(engine: Engine, revision: str) -> Snapshot:
    """Snapshots, upgrades to `revision`, asserts nothing that existed changed, and
    returns the snapshot taken after, for the caller to read what was added."""
    before = snapshot(engine)
    upgrade_to(engine, revision)
    after = snapshot(engine)
    compare(before, after)
    return after
