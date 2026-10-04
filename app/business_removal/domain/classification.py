"""Classifies the live schema into what the removal needs (the plan's invariant):
which tables are a business's own, which aren't and must make the run refuse, which
columns look like a secret, and the order rows must be deleted in.

Nothing here names a business-owned table or column by hand: every table and column
name used is imported from `app/business_removal/domain/exclusions.py`, the one place
that spells out the platform, skipped and withheld tables and the excluded columns.
Everything else is read off the `Schema` passed in, built elsewhere by reflecting the
live database.
"""

from __future__ import annotations

from app.business_removal.domain.exclusions import (
    BUSINESS_TABLE,
    EXCLUDED_COLUMNS,
    INVITATION_TABLE,
    PLATFORM_TABLES,
    SKIPPED_TABLES,
)
from app.business_removal.domain.labels import tables_written
from app.business_removal.domain.schema import Schema, Table

BUSINESS_ID_COLUMN = "business_id"

# Underscore-separated segments that make a column look like it holds a secret.
SECRET_SEGMENTS = frozenset(
    {
        "secret",
        "secrets",
        "token",
        "tokens",
        "hash",
        "digest",
        "password",
        "passwords",
        "credential",
        "credentials",
        "encrypted",
        "ciphertext",
    }
)
# Whole-name suffixes that look like a secret even with no segment of their own above
# (round-2 correction: a bare "key" segment would also flag `variety.name_key`).
SECRET_SUFFIXES = ("api_key", "private_key", "secret_key")


def has_business_id(table: Table) -> bool:
    return any(column.name == BUSINESS_ID_COLUMN for column in table.columns)


def owned_tables(schema: Schema) -> tuple[Table, ...]:
    """Every table with a `business_id` column, plus `business` itself.
    `SKIPPED_TABLES` are left out."""
    return tuple(
        table
        for table in schema.tables
        if table.name not in SKIPPED_TABLES
        and (table.name == BUSINESS_TABLE or has_business_id(table))
    )


def unowned_tables(schema: Schema) -> tuple[str, ...]:
    """Tables with no `business_id` that are neither platform nor skipped: a table
    the removal would otherwise silently leave untouched. A non-empty result means
    the command must refuse to run until the table is given one or added to
    `exclusions.py`."""
    return tuple(
        sorted(
            table.name
            for table in schema.tables
            if table.name not in PLATFORM_TABLES
            and table.name not in SKIPPED_TABLES
            and not has_business_id(table)
        )
    )


def looks_secret(column_name: str) -> bool:
    """The heuristic a secret-like column name is caught by: an underscore-separated
    segment from `SECRET_SEGMENTS`, or the whole name ending in one of
    `SECRET_SUFFIXES`. Matches `password_hash` and `token_digest`; never `name_key`,
    since `key` alone is not a flagged segment."""
    segments = column_name.split("_")
    if any(segment in SECRET_SEGMENTS for segment in segments):
        return True
    return any(column_name.endswith(suffix) for suffix in SECRET_SUFFIXES)


def secret_columns(schema: Schema) -> tuple[tuple[str, str], ...]:
    """Columns that look like a secret, are not already named in `EXCLUDED_COLUMNS`,
    and belong to a table whose rows actually land in the export file
    (`labels.tables_written`, defined once there). A non-empty result means the
    command must refuse: a new secret column needs its own exclusion, named by hand,
    before the removal can run again."""
    written = set(tables_written(schema))
    found = [
        (name, column.name)
        for name in written
        for column in schema.table(name).columns
        if looks_secret(column.name) and (name, column.name) not in EXCLUDED_COLUMNS
    ]
    return tuple(sorted(found))


def delete_order(schema: Schema) -> tuple[str, ...]:
    """Owned tables plus `invitation` (even though its `business_id` is nullable, so
    it might not otherwise count as owned), each child before the table it
    references, `business` last. A cycle makes the run impossible to order safely, so
    it raises, naming every table still stuck in it."""
    all_names = {table.name for table in schema.tables}
    names = {table.name for table in owned_tables(schema)}
    if INVITATION_TABLE in all_names:
        names.add(INVITATION_TABLE)
    tables = {name: schema.table(name) for name in names}

    # Kahn's algorithm: an edge `table -> target` means `table` must be deleted
    # before `target` (its child must go before the parent it references).
    edges: dict[str, set[str]] = {name: set() for name in tables}
    in_degree: dict[str, int] = dict.fromkeys(tables, 0)
    for name, table in tables.items():
        for foreign_key in table.foreign_keys:
            target = foreign_key.target_table
            if target in tables and target != name and target not in edges[name]:
                edges[name].add(target)
                in_degree[target] += 1

    ready = sorted(name for name, degree in in_degree.items() if degree == 0)
    order: list[str] = []
    while ready:
        current = ready.pop(0)
        order.append(current)
        for target in sorted(edges[current]):
            in_degree[target] -= 1
            if in_degree[target] == 0:
                ready.append(target)
        ready.sort()

    if len(order) != len(tables):
        remaining = sorted(set(tables) - set(order))
        raise ValueError(f"the delete order has a cycle through: {', '.join(remaining)}")
    return tuple(order)
