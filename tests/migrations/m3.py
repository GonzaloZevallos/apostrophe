"""The shared M3 comparator: proof that a migration changes no stored value that
existed before it (GH-318 invariant 1). A migration may add tables, columns and rows;
it may not alter, delete or reorder what was already there.

`snapshot` reads every row of every table, as column -> value, keyed by the table's
primary key. `changed_values(before, after)` lists every (table, row, column) of
`before` whose value in `after` differs, plus every table or row that is gone. A table,
row or column that exists only in `after` is an addition and is never reported. A
migration test takes a snapshot after seeding the previous revision, upgrades, takes
another, and asserts `changed_values(before, after) == []`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

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
