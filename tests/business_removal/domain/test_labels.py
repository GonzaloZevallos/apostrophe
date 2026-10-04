"""`unlabelled_tables` (the plan's seam): a table with neither a `name` column nor a
declared label must be refused, over a hand-built schema that proves the rejection
and over the real migrated schema, which must hold none."""

from app.business_removal.domain.exclusions import PLATFORM_TABLES, SKIPPED_TABLES
from app.business_removal.domain.labels import owned_tables, unlabelled_tables
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table
from app.db import make_engine
from app.migrations.runner import upgrade_to_head


def _column(name: str) -> Column:
    return Column(name, ColumnType.INTEGER, nullable=False, primary_key=False)


def test_a_table_with_a_name_column_needs_no_declared_label() -> None:
    schema = Schema((Table("variety", (_column("id"), _column("name")), ()),))

    assert unlabelled_tables(schema) == frozenset()


def test_a_table_declared_by_a_label_column_needs_no_name_column() -> None:
    schema = Schema((Table("sale", (_column("id"), _column("sale_date")), ()),))

    assert unlabelled_tables(schema) == frozenset()


def test_a_table_with_neither_a_name_column_nor_a_declared_label_is_refused() -> None:
    schema = Schema((Table("mystery", (_column("id"), _column("amount")), ()),))

    assert unlabelled_tables(schema) == frozenset({"mystery"})


def test_platform_and_skipped_tables_are_never_reported() -> None:
    schema = Schema(
        (
            Table("business", (_column("id"),), ()),
            Table("invitation", (_column("id"),), ()),
            Table("login_guard", (_column("email"),), ()),
            Table("alembic_version", (_column("version_num"),), ()),
        )
    )

    assert unlabelled_tables(schema) == frozenset()
    assert owned_tables(schema) == ()


def _reflect(engine: object) -> Schema:
    from typing import cast

    from sqlalchemy import inspect
    from sqlalchemy.engine import Engine

    inspector = inspect(cast(Engine, engine))
    tables = []
    for table_name in inspector.get_table_names():
        primary_key_columns = inspector.get_pk_constraint(table_name)["constrained_columns"]
        columns = tuple(
            Column(
                column["name"],
                ColumnType.OTHER,
                nullable=column["nullable"],
                primary_key=column["name"] in primary_key_columns,
            )
            for column in inspector.get_columns(table_name)
        )
        foreign_keys = tuple(
            ForeignKey(
                tuple(fk["constrained_columns"]),
                fk["referred_table"],
                tuple(fk["referred_columns"]),
            )
            for fk in inspector.get_foreign_keys(table_name)
        )
        tables.append(Table(table_name, columns, foreign_keys))
    return Schema(tuple(tables))


def test_the_migrated_schema_holds_no_unlabelled_table() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)

    schema = _reflect(engine)

    assert unlabelled_tables(schema) == frozenset()
    # Sanity: the owned tables are more than the platform tables alone, and the
    # platform/skipped tables never show up among them.
    owned = owned_tables(schema)
    assert owned
    assert PLATFORM_TABLES.isdisjoint(owned)
    assert SKIPPED_TABLES.isdisjoint(owned)
