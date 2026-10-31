"""The shared M3 comparator: a migration changes no value of a column that existed before
it (plan invariant). It only adds tables, columns and rows, or fills the columns it adds.

`snapshot` reads every row of every table before an `upgrade`; `changed_values` compares
that snapshot with the same read after it and lists every pre-existing value that is no
longer there. A migration's test seeds rows, takes a snapshot, upgrades, and asserts the
list is empty (`assert_no_value_changed`). Test-only: nothing at runtime needs it.

Rows are matched on their primary key (the whole row for a table without one), so an
added row or column is never a difference, while a changed, vanished or retyped value is.
"""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

Row = dict[str, object]
Snapshot = dict[str, tuple[tuple[str, ...], list[Row]]]

# Alembic's own bookkeeping moves on every upgrade; it is not a business table.
_IGNORED_TABLES = {"alembic_version"}


def snapshot(engine: Engine) -> Snapshot:
    """Every table's primary key columns and every row, as read from the real schema."""
    inspector = inspect(engine)
    taken: Snapshot = {}
    with engine.connect() as connection:
        for table in inspector.get_table_names():
            if table in _IGNORED_TABLES:
                continue
            key = tuple(inspector.get_pk_constraint(table)["constrained_columns"])
            rows = [
                dict(row._mapping) for row in connection.execute(text(f'SELECT * FROM "{table}"'))
            ]
            taken[table] = (key, rows)
    return taken


def _identity(row: Row, key: tuple[str, ...], before_columns: set[str]) -> tuple[object, ...]:
    columns = key or tuple(sorted(before_columns))
    return tuple(row[column] for column in columns)


def changed_values(before: Snapshot, after: Snapshot) -> list[str]:
    """One line per pre-existing value that is gone or different after the upgrade: a
    dropped table, a dropped row, a dropped column or a changed value. Empty when the
    migration only added."""
    problems: list[str] = []
    for table, (key, rows) in before.items():
        if table not in after:
            problems.append(f"{table}: the table is gone")
            continue
        _, after_rows = after[table]
        before_columns = set(rows[0]) if rows else set()
        by_identity: dict[tuple[object, ...], list[Row]] = {}
        for row in after_rows:
            by_identity.setdefault(_identity(row, key, before_columns), []).append(row)
        for row in rows:
            matches = by_identity.get(_identity(row, key, before_columns), [])
            if not matches:
                problems.append(f"{table}: the row {_identity(row, key, before_columns)} is gone")
                continue
            for column, value in row.items():
                if not any(column in match and match[column] == value for match in matches):
                    problems.append(f"{table}.{column}: {value!r} is no longer there")
    return problems


def assert_no_value_changed(before: Snapshot, after: Snapshot) -> None:
    problems = changed_values(before, after)
    assert not problems, "a migration changed an existing value:\n" + "\n".join(problems)
