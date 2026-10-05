"""CODING_STANDARDS §11: every table, column, index and constraint in the product
follows the database naming rules, checked against a real SQLite schema (never an
object's `.name` in the metadata).

(a) checks the migrated schema's breaks against `ALLOWLIST`, the exact, literal set of
breaks the rules find today: a new break and a stale allowlist entry both fail. (b)
checks that the migrated schema and the one `app.tables.metadata.create_all` builds
agree on every key and its name. (c) is the synthetic suite: a small `MetaData` that
breaks one rule at a time, caught by `breaks`, plus one that stays clean.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.engine import Engine

from app.db import NAMING_CONVENTION, make_engine
from app.migrations.runner import upgrade_to_head
from app.tables import metadata as declared_metadata
from tests.migrations.naming import Break, Schema, breaks, reflect

# The exact set of breaks the first run found on the migrated schema. #75 renames each
# of these; until then, a new break and a stale entry here both fail this test.
ALLOWLIST: frozenset[Break] = frozenset(
    {
        ("catalog_attributes", "column", ("shown",), "is_"),
        ("customer", "column", ("vip",), "is_"),
        ("customer", "unique", ("business_id", "phone"), "uq_name"),
        ("expense", "foreign_key", ("business_id", "category_id"), "fk_name"),
        ("login_address_guard", "column", ("locked_until",), "_at"),
        ("login_address_guard", "column", ("window_start",), "_at"),
        ("login_address_guard", "primary_key", ("address_digest",), "pk_id"),
        ("login_guard", "column", ("locked_until",), "_at"),
        ("login_guard", "primary_key", ("email",), "pk_id"),
        ("price_entry", "column", ("effective_from",), "_on"),
        ("reset_link", "foreign_key", ("user_id",), "fk_name"),
        ("sale", "column", ("sale_date",), "_on"),
        ("stock_entry", "column", ("entry_date",), "_on"),
    }
)


def _create_and_reflect(metadata: MetaData) -> Schema:
    engine = create_engine("sqlite://")
    metadata.create_all(engine)
    return reflect(engine)


def test_the_migrated_schema_breaks_exactly_the_allowlist() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)

    assert breaks(reflect(engine)) == ALLOWLIST


def test_the_migrated_and_declared_schemas_agree_on_every_name() -> None:
    migrated_engine = make_engine("sqlite://")
    upgrade_to_head(migrated_engine)
    migrated = reflect(migrated_engine)

    declared_engine: Engine = create_engine("sqlite://")
    declared_metadata.create_all(declared_engine)
    declared = reflect(declared_engine)

    assert set(migrated.names) == set(declared.names)
    for key, name in migrated.names.items():
        assert declared.names[key] == name


def test_a_boolean_column_without_is_prefix_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("widget", metadata, Column("id", Integer, primary_key=True), Column("flag", Boolean))

    assert ("widget", "column", ("flag",), "is_") in breaks(_create_and_reflect(metadata))


def test_an_is_prefixed_column_that_is_not_boolean_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("is_name", String(10)),
    )

    assert ("widget", "column", ("is_name",), "is_") in breaks(_create_and_reflect(metadata))


def test_a_date_column_without_on_suffix_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("widget", metadata, Column("id", Integer, primary_key=True), Column("opened", Date))

    assert ("widget", "column", ("opened",), "_on") in breaks(_create_and_reflect(metadata))


def test_an_on_suffixed_column_that_is_not_a_date_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("widget", metadata, Column("id", Integer, primary_key=True), Column("price_on", Integer))

    assert ("widget", "column", ("price_on",), "_on") in breaks(_create_and_reflect(metadata))


def test_a_datetime_column_without_at_suffix_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("widget", metadata, Column("id", Integer, primary_key=True), Column("closed", DateTime))

    assert ("widget", "column", ("closed",), "_at") in breaks(_create_and_reflect(metadata))


def test_an_at_suffixed_column_that_is_not_a_datetime_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("token_at", String(10)),
    )

    assert ("widget", "column", ("token_at",), "_at") in breaks(_create_and_reflect(metadata))


def test_a_foreign_key_whose_name_only_shares_a_substring_with_the_table_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("sale", metadata, Column("id", Integer, primary_key=True))
    Table(
        "offer",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("wholesale_id", Integer, ForeignKey("sale.id")),
    )

    assert ("offer", "foreign_key", ("wholesale_id",), "fk_name") in breaks(
        _create_and_reflect(metadata)
    )


def test_a_foreign_key_with_a_whole_word_role_prefix_passes() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("app_user", metadata, Column("id", Integer, primary_key=True))
    Table("variety", metadata, Column("id", Integer, primary_key=True))
    Table(
        "task",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("assigned_app_user_id", Integer, ForeignKey("app_user.id")),
        Column("parent_variety_id", Integer, ForeignKey("variety.id")),
    )

    found = breaks(_create_and_reflect(metadata))

    assert ("task", "foreign_key", ("assigned_app_user_id",), "fk_name") not in found
    assert ("task", "foreign_key", ("parent_variety_id",), "fk_name") not in found


def test_a_primary_key_not_named_id_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("widget", metadata, Column("code", Integer, primary_key=True))

    assert ("widget", "primary_key", ("code",), "pk_id") in breaks(_create_and_reflect(metadata))


def test_a_hand_named_index_breaking_its_pattern_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("code", Integer),
        Index("ix_not_the_convention", "code"),
    )

    assert ("widget", "index", ("code",), "ix_name") in breaks(_create_and_reflect(metadata))


def test_a_hand_named_unique_constraint_breaking_its_pattern_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("code", Integer),
        UniqueConstraint("code", name="uq_not_the_convention"),
    )

    assert ("widget", "unique", ("code",), "uq_name") in breaks(_create_and_reflect(metadata))


def test_a_check_constraint_breaking_its_pattern_breaks() -> None:
    # No naming convention: a literal name bypasses the `ck_<table>_` prefix the
    # convention would otherwise add.
    metadata = MetaData()
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer),
        CheckConstraint("amount > 0", name="not_the_convention"),
    )

    assert ("widget", "check", (), "ck_name") in breaks(_create_and_reflect(metadata))


def test_an_unnamed_constraint_breaks() -> None:
    # No naming convention: SQLAlchemy emits the constraint with no name at all, and
    # SQLite reflects it back as unnamed.
    metadata = MetaData()
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("code", Integer),
        UniqueConstraint("code"),
    )

    assert ("widget", "unique", ("code",), "unnamed") in breaks(_create_and_reflect(metadata))


def test_a_non_snake_case_name_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table("WidgetThing", metadata, Column("id", Integer, primary_key=True))

    assert ("WidgetThing", "table", (), "snake_case") in breaks(_create_and_reflect(metadata))


def test_a_clean_table_yields_no_breaks() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("is_active", Boolean),
        Column("started_on", Date),
        Column("created_at", DateTime),
    )

    assert breaks(_create_and_reflect(metadata)) == set()


def test_a_composite_index_with_no_literal_name_follows_the_ix_convention() -> None:
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    Table(
        "widget",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("a", Integer),
        Column("b", Integer),
        Index(None, "a", "b"),
    )

    schema = _create_and_reflect(metadata)
    assert schema.names[next(k for k in schema.names if k.kind == "index")] == "ix_widget_a_b"
    assert breaks(schema) == set()
