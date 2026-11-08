"""The allowed-schema comparator (docs/adr/0076; the plan's invariant 1), beside comparator.py.

It proves a migration changed no value of any pre-existing column.

`compare_migration` builds a database at `from_revision`, lets `seed` fill it, snapshots
every table and column, upgrades to `to_revision` and checks that:

- every pre-existing table and column is still there;
- every pre-existing column holds the same value, row by row;
- the schema differs only by the migration's own `Allowed` list: columns that went from
  NOT NULL to NULL, and columns that were added to a table that already existed.

A migration adds its own entry to the `Allowed` it passes; nothing is allowed by default.
`violations` returns the list, so a test can also feed it a snapshot it must reject.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT

VERSION_TABLE = "alembic_version"  # the migration tool's own bookkeeping, not data
Cell = Any
Column = tuple[str, str]  # (table, column)


@dataclass(frozen=True)
class Allowed:
    """The schema changes one migration may make to what existed before it."""

    relaxed_to_null: frozenset[Column] = frozenset()
    added_not_null: frozenset[Column] = frozenset()
    added_nullable: frozenset[Column] = frozenset()


@dataclass(frozen=True)
class TableSnapshot:
    nullable: dict[str, bool]
    types: dict[str, str]
    rows: list[dict[str, Cell]] = field(default_factory=list)


Snapshot = dict[str, TableSnapshot]


def step(engine: Engine, action: str, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            getattr(command, action)(config, revision)


def snapshot(connection: Connection) -> Snapshot:
    inspector = inspect(connection)
    taken: Snapshot = {}
    for table in inspector.get_table_names():
        if table == VERSION_TABLE:
            continue
        columns = inspector.get_columns(table)
        names = [c["name"] for c in columns]
        listed = ", ".join(f'"{name}"' for name in names)
        rows = [
            dict(zip(names, row, strict=True))
            for row in connection.execute(text(f'SELECT {listed} FROM "{table}" ORDER BY 1'))
        ]
        taken[table] = TableSnapshot(
            nullable={c["name"]: bool(c["nullable"]) for c in columns},
            types={c["name"]: str(c["type"]) for c in columns},
            rows=rows,
        )
    return taken


def violations(before: Snapshot, after: Snapshot, allowed: Allowed) -> list[str]:
    found: list[str] = []
    for table, was in before.items():
        if table not in after:
            found.append(f"table {table} is gone")
            continue
        now = after[table]
        for column in was.nullable:
            if column not in now.nullable:
                found.append(f"column {table}.{column} is gone")
                continue
            if was.types[column] != now.types[column]:
                found.append(f"column {table}.{column} changed type")
            if was.nullable[column] != now.nullable[column]:
                relaxed = (table, column) in allowed.relaxed_to_null
                if not (relaxed and not was.nullable[column] and now.nullable[column]):
                    found.append(f"column {table}.{column} changed nullability")
        added = {
            (table, column): nullable
            for column, nullable in now.nullable.items()
            if column not in was.nullable
        }
        for pair, nullable in added.items():
            allowed_set = allowed.added_nullable if nullable else allowed.added_not_null
            if pair not in allowed_set:
                found.append(f"column {pair[0]}.{pair[1]} was added and is not allowed")
        found.extend(_changed_values(table, was, now))
    for table, column in allowed.relaxed_to_null | allowed.added_not_null | allowed.added_nullable:
        if table not in after or column not in after[table].nullable:
            found.append(f"allowed change {table}.{column} did not happen")
    return found


def _changed_values(table: str, was: TableSnapshot, now: TableSnapshot) -> list[str]:
    if len(was.rows) != len(now.rows):
        return [f"table {table} had {len(was.rows)} rows and has {len(now.rows)}"]
    found: list[str] = []
    for position, (old, new) in enumerate(zip(was.rows, now.rows, strict=True)):
        for column, value in old.items():
            if column in new and new[column] != value:
                found.append(
                    f"{table}.{column} of row {position} was {value!r} and is {new[column]!r}"
                )
    return found


def compare_migration(
    *,
    from_revision: str,
    to_revision: str,
    seed: Callable[[Connection], None],
    allowed: Allowed,
) -> tuple[Snapshot, Snapshot]:
    """Seed at `from_revision`, upgrade to `to_revision`, and fail on any violation.
    Answers both snapshots so the migration's own test can check what it added."""
    engine = make_engine("sqlite://")
    step(engine, "upgrade", from_revision)
    with engine.begin() as connection:
        seed(connection)
    with engine.connect() as connection:
        before = snapshot(connection)
    step(engine, "upgrade", to_revision)
    with engine.connect() as connection:
        after = snapshot(connection)
    found = violations(before, after, allowed)
    assert not found, "\n".join(found)
    return before, after
