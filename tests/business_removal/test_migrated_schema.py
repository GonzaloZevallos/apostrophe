"""Every condition that would make the removal refuse at run time because of the
schema is asserted here, over the real migrated schema (the plan's invariant): today's
database must never trip `unowned_tables`, `secret_columns` or a `delete_order` cycle.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.business_removal.adapters.sql_schema_rows import SqlSchemaRows
from app.business_removal.domain.classification import (
    delete_order,
    looks_secret,
    owned_tables,
    secret_columns,
    unowned_tables,
)
from app.db import make_engine
from app.migrations.runner import upgrade_to_head


def _schema_rows() -> SqlSchemaRows:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    return SqlSchemaRows(Session(engine))


def test_no_table_is_left_without_a_business_id() -> None:
    schema = _schema_rows().schema()

    assert unowned_tables(schema) == ()


def test_no_secret_like_column_is_left_unexcluded() -> None:
    schema = _schema_rows().schema()

    assert secret_columns(schema) == ()


def test_the_raw_secret_pattern_matches_exactly_the_known_secrets() -> None:
    schema = _schema_rows().schema()

    matches = {
        (table.name, column.name)
        for table in schema.tables
        for column in table.columns
        if looks_secret(column.name)
    }

    assert matches == {
        ("app_user", "password_hash"),
        ("invitation", "token_digest"),
        ("login_address_guard", "address_digest"),
        ("pinned_catalog", "token_ciphertext"),
        ("pinned_catalog", "token_fingerprint"),
        ("pinned_catalog", "message_token_fingerprint"),
        ("pinned_catalog", "token_saved_on"),
        ("reset_link", "token_digest"),
    }
    # The pattern test's own reason to exist: a bare "key" segment would also catch
    # these, and the removal would then refuse every run.
    assert not looks_secret("name_key")


def test_delete_order_covers_every_owned_table() -> None:
    schema = _schema_rows().schema()

    order = delete_order(schema)

    assert set(order) >= {table.name for table in owned_tables(schema)}
    assert order[-1] == "business"
