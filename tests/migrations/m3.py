"""The shared M3 comparator (GH-318 invariant 1): a migration never changes the value of
a column that existed before it.

`assert_m3(from_revision, to_revision)` builds a database at `from_revision`, fills every
table through the registered seed increments (`tests/migrations/m3_seed.py`), snapshots
it, upgrades to `to_revision`, snapshots again and requires every table that existed to
be byte-for-byte what it was: same DDL, same rows. It returns the names of the tables the
upgrade created, so the calling migration test can assert on them.

A migration part never copies this module: it adds its seed increment to the registry and
calls `assert_m3`.
"""

from dataclasses import dataclass

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to
from tests.migrations import m3_seed

PLATFORM_BOOKKEEPING = "alembic_version"


@dataclass(frozen=True)
class TableSnapshot:
    ddl: str
    rows: tuple[tuple[object, ...], ...]


def snapshot(connection: Connection) -> dict[str, TableSnapshot]:
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
    engine = make_engine("sqlite://")
    upgrade_to(engine, from_revision)
    with engine.begin() as connection:
        for revision in _chain_up_to(from_revision):
            increment = m3_seed.SEED_INCREMENTS.get(revision)
            if increment is not None:
                increment(connection)
        before = snapshot(connection)
    empty = sorted(name for name, table in before.items() if not table.rows)
    if empty:
        raise AssertionError(f"the seed leaves tables empty at {from_revision}: {empty}")

    upgrade_to(engine, to_revision)
    with engine.connect() as connection:
        after = snapshot(connection)
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
