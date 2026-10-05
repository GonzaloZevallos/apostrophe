"""The exclusion sets are the only business-owned names written by hand in this hexagon
(the plan's invariant): everything else is discovered from the live schema elsewhere."""

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.business_removal.domain.classification import has_business_id
from app.business_removal.domain.exclusions import (
    EXCLUDED_COLUMNS,
    PLATFORM_TABLES,
    SKIPPED_TABLES,
    WITHHELD_TABLES,
)
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table
from app.db import make_engine
from app.migrations.runner import upgrade_to_head


def _reflect(engine: Engine) -> Schema:
    inspector = inspect(engine)
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


def test_every_withheld_table_is_a_platform_table_or_has_a_business_id() -> None:
    """Withheld no longer implies platform (docs/adr/0019): `reset_link` is withheld
    but owns its own `business_id`. `login_guard`, withheld too, has neither a
    `business_id` nor needs one -- it is a platform table."""
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    schema = _reflect(engine)

    for name in WITHHELD_TABLES:
        assert name in PLATFORM_TABLES or has_business_id(schema.table(name)), name


def test_a_table_with_neither_trait_fails_the_check_above() -> None:
    """Proven negative (CODING_STANDARDS §5): a withheld-looking table that is
    neither a platform table nor carries its own `business_id` must fail -- proven
    against a hand-built table, not the real schema, so the positive test above
    cannot pass by accident."""
    mystery = Table(
        "mystery", (Column("id", ColumnType.INTEGER, nullable=False, primary_key=True),), ()
    )

    assert "mystery" not in PLATFORM_TABLES
    assert not has_business_id(mystery)


def test_the_skipped_tables_are_not_platform_tables() -> None:
    assert SKIPPED_TABLES.isdisjoint(PLATFORM_TABLES)


def test_the_business_table_is_a_platform_table_and_never_withheld() -> None:
    assert "business" in PLATFORM_TABLES
    assert "business" not in WITHHELD_TABLES


def test_the_password_hash_column_is_excluded() -> None:
    assert ("app_user", "password_hash") in EXCLUDED_COLUMNS
