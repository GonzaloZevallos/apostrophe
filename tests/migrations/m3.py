"""The shared M3 comparator: proof that a migration changes no stored value that
existed before it (GH-318 invariant 1). A migration may add tables, columns and rows;
it may not alter, delete or reorder what was already there.

`snapshot` reads every row of every table, as column -> value, keyed by the table's
primary key. `changed_values(before, after)` lists every (table, row, column) of
`before` whose value in `after` differs, plus every table or row that is gone. A table,
row or column that exists only in `after` is an addition and is never reported. A
migration test takes a snapshot after seeding the previous revision, upgrades, takes
another, and asserts `changed_values(before, after) == []`.

The second half of this module is the seeded comparator of the M3 registry
(`tests/migrations/m3_seed.py`): `assert_m3(from_revision, to_revision)` builds a database at
`from_revision`, fills every table through the registered seed increments, snapshots it
(`snapshot_tables`), upgrades, snapshots again and requires every table that existed to be
byte-for-byte what it was (`assert_unchanged`): same DDL, same rows. It returns the names of
the tables the upgrade created. A migration part never copies this module: it adds its seed
increment to the registry and calls `assert_m3`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to
from tests.migrations import m3_seed

Row = dict[str, Any]
# table name -> primary-key tuple -> the row as stored
Snapshot = dict[str, dict[tuple[Any, ...], Row]]


def snapshot(engine: Engine) -> Snapshot:
    inspector = inspect(engine)
    taken: Snapshot = {}
    with engine.connect() as connection:
        for table in sorted(inspector.get_table_names()):
            if table == "alembic_version":
                continue
            key_columns = inspector.get_pk_constraint(table)["constrained_columns"]
            rows: dict[tuple[Any, ...], Row] = {}
            for result in connection.execute(text(f'SELECT * FROM "{table}"')).mappings():
                row = dict(result)
                rows[tuple(row[column] for column in key_columns)] = row
            taken[table] = rows
    return taken


def changed_values(before: Snapshot, after: Snapshot) -> list[str]:
    """One line per value, row or table of `before` that `after` no longer holds as it
    was; empty when the migration only added."""
    changes: list[str] = []
    for table, rows in before.items():
        if table not in after:
            changes.append(f"{table}: table gone")
            continue
        for key, row in rows.items():
            kept = after[table].get(key)
            if kept is None:
                changes.append(f"{table}{list(key)}: row gone")
                continue
            for column, value in row.items():
                if column not in kept:
                    changes.append(f"{table}{list(key)}.{column}: column gone")
                elif kept[column] != value:
                    changes.append(f"{table}{list(key)}.{column}: {value!r} -> {kept[column]!r}")
    return changes


PLATFORM_BOOKKEEPING = "alembic_version"


@dataclass(frozen=True)
class TableSnapshot:
    ddl: str
    rows: tuple[tuple[object, ...], ...]


def snapshot_tables(connection: Connection) -> dict[str, TableSnapshot]:
    """Every table but `alembic_version`, with its DDL and all its rows in primary-key
    order (a table keyed by something other than `id` is ordered by its own key)."""
    tables = connection.execute(
        text("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
    ).all()
    snapshots: dict[str, TableSnapshot] = {}
    for name, ddl in tables:
        if name == PLATFORM_BOOKKEEPING:
            continue
        order = _order_by(connection, name)
        rows = connection.execute(text(f'SELECT * FROM "{name}" ORDER BY {order}')).all()
        snapshots[name] = TableSnapshot(ddl=ddl, rows=tuple(tuple(row) for row in rows))
    return snapshots


def _order_by(connection: Connection, table: str) -> str:
    columns = connection.execute(text(f'PRAGMA table_info("{table}")')).all()
    keyed = sorted((column for column in columns if column.pk > 0), key=lambda c: c.pk)
    names = [column.name for column in keyed] or [column.name for column in columns]
    return ", ".join(f'"{name}"' for name in names)


def assert_unchanged(
    before: dict[str, TableSnapshot], after: dict[str, TableSnapshot]
) -> frozenset[str]:
    """Fails naming the table when one of `before` is gone from `after` or differs in DDL
    or rows; returns the names of the tables only `after` has."""
    for name, was in sorted(before.items()):
        now = after.get(name)
        if now is None:
            raise AssertionError(f"table {name} is missing after the migration")
        if now.ddl != was.ddl:
            raise AssertionError(f"table {name}: the DDL changed\n{was.ddl}\n->\n{now.ddl}")
        if now.rows != was.rows:
            raise AssertionError(f"table {name}: the rows changed\n{was.rows}\n->\n{now.rows}")
    return frozenset(after) - frozenset(before)


def assert_m3(from_revision: str, to_revision: str) -> frozenset[str]:
    """Walks the chain from the base: the engine is upgraded to each revision in turn and
    that revision's seed increment (if any) runs against the schema as it is there, so a
    later migration's own backfill transforms the seeded rows before the snapshot."""
    engine = make_engine("sqlite://")
    for revision in _chain_up_to(from_revision):
        upgrade_to(engine, revision)
        increment = m3_seed.SEED_INCREMENTS.get(revision)
        if increment is not None:
            with engine.begin() as connection:
                increment(connection)
    with engine.connect() as connection:
        before = snapshot_tables(connection)
    empty = sorted(name for name, table in before.items() if not table.rows)
    if empty:
        raise AssertionError(f"the seed leaves tables empty at {from_revision}: {empty}")

    upgrade_to(engine, to_revision)
    with engine.connect() as connection:
        after = snapshot_tables(connection)
    return assert_unchanged(before, after)


def _chain_up_to(revision: str) -> list[str]:
    """The revisions from the base to `revision`, in chain order."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_ROOT))
    script = ScriptDirectory.from_config(config)
    chain = [step.revision for step in script.walk_revisions()][::-1]
    if revision not in chain:
        raise AssertionError(f"revision {revision} is not in the migration chain")
    unknown = sorted(set(m3_seed.SEED_INCREMENTS) - set(chain))
    if unknown:
        raise AssertionError(f"seed increments for revisions not in the chain: {unknown}")
    return chain[: chain.index(revision) + 1]
