"""The reflection-based naming checker (CODING_STANDARDS §11), test-only: nothing at
runtime needs it, so it stays out of `app/`.

`reflect` is the one reader, used on both the `upgrade_to_head` schema and the
`app.tables.metadata.create_all` schema (`tests/migrations/test_naming.py`): it never
reads `.name` off a `MetaData` object, only what SQLAlchemy's inspector finds on the
real SQLite schema. `breaks` is the pure rule set, run on a `Schema`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

Kind = str  # table | column | index | unique | primary_key | foreign_key | check

SNAKE_CASE = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")

# Reflected type class names that mean "boolean", "date" and "datetime" respectively.
# `UtcDateTime` (app/db.py) is a `TypeDecorator` over `DateTime`, so it reflects back as
# a plain DATETIME, same as every other instant column.
_BOOLEAN_TYPES = {"BOOLEAN"}
_DATE_TYPES = {"DATE"}
_DATETIME_TYPES = {"DATETIME"}

# A break: the entry's table, kind and columns, and the one rule it fails.
Break = tuple[str, str, tuple[str, ...], str]


@dataclass(frozen=True)
class Key:
    table: str
    kind: Kind
    columns: tuple[str, ...]
    # Only meaningful for kind == "foreign_key": what the columns point at, so two
    # foreign keys sharing a column prefix (`expense`'s own two) never collide.
    referred_table: str | None = None
    referred_columns: tuple[str, ...] | None = None


@dataclass
class Schema:
    # The name SQLite reflects for each key, or None when the constraint reflects with
    # no name at all.
    names: dict[Key, str | None] = field(default_factory=dict)
    # The reflected type class name (upper-cased) of every column, keyed by
    # (table, column): what the is_/_on/_at rules read instead of a declared type.
    column_types: dict[tuple[str, str], str] = field(default_factory=dict)


def reflect(engine: Engine) -> Schema:
    inspector = inspect(engine)
    schema = Schema()

    for table in sorted(inspector.get_table_names()):
        if table == "alembic_version":
            continue
        schema.names[Key(table, "table", ())] = table

        for column in inspector.get_columns(table):
            name = str(column["name"])
            schema.names[Key(table, "column", (name,))] = name
            schema.column_types[(table, name)] = type(column["type"]).__name__.upper()

        pk = inspector.get_pk_constraint(table)
        pk_columns = tuple(pk.get("constrained_columns") or ())
        if pk_columns:
            schema.names[Key(table, "primary_key", pk_columns)] = pk.get("name")

        for fk in inspector.get_foreign_keys(table):
            local_columns = tuple(fk["constrained_columns"])
            referred_table = str(fk["referred_table"])
            referred_columns = tuple(fk["referred_columns"])
            key = Key(table, "foreign_key", local_columns, referred_table, referred_columns)
            schema.names[key] = fk.get("name")

        for unique in inspector.get_unique_constraints(table):
            columns = tuple(unique["column_names"])
            schema.names[Key(table, "unique", columns)] = unique.get("name")

        for index in inspector.get_indexes(table):
            # No index in this product is built on an expression, so no column name
            # reflects as None (SQLAlchemy's stub allows it only for that case).
            columns = tuple(str(name) for name in index["column_names"])
            schema.names[Key(table, "index", columns)] = index.get("name")

        for check in inspector.get_check_constraints(table):
            # SQLite's inspector names no columns for a check constraint; one table
            # with more than one check constraint is outside this product today.
            schema.names[Key(table, "check", ())] = check.get("name")

    return schema


def breaks(schema: Schema) -> set[Break]:
    found: set[Break] = set()

    for key, name in schema.names.items():
        found |= _break_unnamed(key, name)
        if name is None:
            continue
        found |= _break_snake_case(key, name)
        found |= _break_pattern(key, name)

    for (table, column), type_name in schema.column_types.items():
        found |= _break_is_boolean(table, column, type_name)
        found |= _break_on_date(table, column, type_name)
        found |= _break_at_datetime(table, column, type_name)

    for key in schema.names:
        if key.kind != "primary_key":
            continue
        if key.columns != ("id",):
            found.add((key.table, key.kind, key.columns, "pk_id"))

    for key, name in schema.names.items():
        if key.kind != "foreign_key" or name is None:
            continue
        if not _fk_columns_ok(key):
            found.add((key.table, key.kind, key.columns, "fk_name"))

    return found


def _break_unnamed(key: Key, name: str | None) -> set[Break]:
    if name is not None:
        return set()
    if key.kind in ("unique", "primary_key", "foreign_key", "check"):
        return {(key.table, key.kind, key.columns, "unnamed")}
    return set()


def _break_snake_case(key: Key, name: str) -> set[Break]:
    if SNAKE_CASE.match(name):
        return set()
    return {(key.table, key.kind, key.columns, "snake_case")}


def _break_pattern(key: Key, name: str) -> set[Break]:
    if key.kind == "index":
        expected = f"ix_{key.table}_{'_'.join(key.columns)}"
        rule = "ix_name"
    elif key.kind == "unique":
        expected = f"uq_{key.table}_{'_'.join(key.columns)}"
        rule = "uq_name"
    elif key.kind == "primary_key":
        expected = f"pk_{key.table}"
        rule = "pk_name"
    elif key.kind == "foreign_key":
        expected = f"fk_{key.table}_{key.columns[0]}_{key.referred_table}"
        rule = "fk_name_pattern"
    elif key.kind == "check":
        if name.startswith(f"ck_{key.table}_"):
            return set()
        return {(key.table, key.kind, key.columns, "ck_name")}
    else:
        return set()
    if name == expected:
        return set()
    return {(key.table, key.kind, key.columns, rule)}


def _break_is_boolean(table: str, column: str, type_name: str) -> set[Break]:
    is_boolean = type_name in _BOOLEAN_TYPES
    starts_is = column.startswith("is_")
    if is_boolean == starts_is:
        return set()
    return {(table, "column", (column,), "is_")}


def _break_on_date(table: str, column: str, type_name: str) -> set[Break]:
    is_date = type_name in _DATE_TYPES
    ends_on = column.endswith("_on")
    if is_date == ends_on:
        return set()
    return {(table, "column", (column,), "_on")}


def _break_at_datetime(table: str, column: str, type_name: str) -> set[Break]:
    is_datetime = type_name in _DATETIME_TYPES
    ends_at = column.endswith("_at")
    if is_datetime == ends_at:
        return set()
    return {(table, "column", (column,), "_at")}


def _fk_columns_ok(key: Key) -> bool:
    assert key.referred_table is not None
    assert key.referred_columns is not None
    for local_column, referred_column in zip(key.columns, key.referred_columns, strict=True):
        if referred_column == "id":
            expected_segments = [*key.referred_table.split("_"), "id"]
            local_segments = local_column.split("_")
            if local_segments[-len(expected_segments) :] != expected_segments:
                return False
        elif local_column != referred_column:
            return False
    return True
