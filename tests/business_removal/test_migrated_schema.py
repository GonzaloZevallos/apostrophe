"""Every condition that would make the removal refuse at run time because of the
schema is asserted here, over the real migrated schema (the plan's invariant): today's
database must never trip `unowned_tables`, `secret_columns` or a `delete_order` cycle.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.business_removal.adapters.sql_schema_rows import SqlSchemaRows
from app.business_removal.domain.classification import (
    delete_order,
    looks_secret,
    owned_tables,
    secret_columns,
    unowned_tables,
)
from app.business_removal.domain.export_document import Business, build_document
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


def test_expense_to_expense_category_fk_reflects_as_one_composite_key() -> None:
    """`expense`'s migration (0003) declares a two-column `ForeignKeyConstraint` on
    `(business_id, expense_category_id)` targeting `expense_category`'s `(business_id, id)`,
    alongside its separate single-column key to `business`. Reflection must keep the
    composite key as one `ForeignKey` with two columns, never split it into two
    single-column ones, or `delete_order` could place `expense` wrongly."""
    schema = _schema_rows().schema()

    expense = schema.table("expense")
    to_category = [fk for fk in expense.foreign_keys if fk.target_table == "expense_category"]

    assert len(to_category) == 1
    foreign_key = to_category[0]
    assert len(foreign_key.columns) == 2
    assert set(zip(foreign_key.columns, foreign_key.target_columns, strict=True)) == {
        ("business_id", "business_id"),
        ("expense_category_id", "id"),
    }


def test_every_business_column_but_id_is_a_key_of_the_export_header() -> None:
    schema = _schema_rows().schema()
    columns = {column.name for column in schema.table("business").columns} - {"id"}

    document = build_document(
        Business(1, "La Flor", "en", None, 0), schema, {}, datetime(2026, 1, 1, 12, 0, 0)
    )

    assert columns <= set(document["business"]), columns - set(document["business"])


def test_a_locked_email_of_a_removed_business_s_user_is_counted_and_deleted() -> None:
    """`login_guard` now has an `id` but still no `business_id` (docs/adr/0077), so the
    removal reaches it by the emails `app_user`'s delete returned, never by `id`."""
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with engine.begin() as connection:
        for business_id, email in ((1, "leaving@example.com"), (2, "staying@example.com")):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:id, 'Negocio', 'en')"),
                {"id": business_id},
            )
            connection.execute(
                text(
                    "INSERT INTO app_user (id, business_id, email, password_hash) "
                    "VALUES (:id, :id, :email, 'x')"
                ),
                {"id": business_id, "email": email},
            )
            connection.execute(
                text(
                    "INSERT INTO login_guard (email, failures, unlocks_at) "
                    "VALUES (:email, 2, '2026-10-02 18:10:00.000000')"
                ),
                {"email": email},
            )
        connection.execute(
            text("INSERT INTO login_guard (email, failures) VALUES ('stranger@example.com', 1)")
        )

    with Session(engine) as session:
        rows = SqlSchemaRows(session)
        deleted = rows.delete_business(1, delete_order(rows.schema()))
        session.commit()

    assert deleted.login_guard_count == 1
    with engine.connect() as connection:
        left = connection.execute(text("SELECT email FROM login_guard ORDER BY email")).scalars()
        assert list(left) == ["staying@example.com", "stranger@example.com"]


def test_the_export_carries_the_renamed_date_columns_and_neither_old_name() -> None:
    schema = _schema_rows().schema()

    columns = {table.name: {column.name for column in table.columns} for table in schema.tables}

    assert "sold_on" in columns["sale"]
    assert "entered_on" in columns["stock_entry"]
    assert not {"sale_date", "entry_date"} & {name for names in columns.values() for name in names}


def test_the_export_carries_catalog_attribute_with_is_shown_and_is_vip_on_customer() -> None:
    schema = _schema_rows().schema()

    columns = {table.name: {column.name for column in table.columns} for table in schema.tables}

    assert "is_shown" in columns["catalog_attribute"]
    assert "is_vip" in columns["customer"]
    assert "catalog_attributes" not in columns
    assert not {"shown", "vip"} & (columns["catalog_attribute"] | columns["customer"])
