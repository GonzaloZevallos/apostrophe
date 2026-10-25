"""What the removal works out from the live schema alone (the plan's invariant): which
tables are a business's own, which aren't (and must refuse the run), which columns
look like a secret, and the order rows must be deleted in. Hand-built `Schema`s here;
the same functions run over the real migrated schema in
`tests/business_removal/test_migrated_schema.py`.
"""

from __future__ import annotations

import pytest

from app.business_removal.domain.classification import (
    DeleteOrderCycle,
    delete_order,
    looks_secret,
    other_type_columns,
    owned_tables,
    secret_columns,
    unowned_tables,
)
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table


def _col(name: str, type_: ColumnType = ColumnType.INTEGER, *, nullable: bool = False) -> Column:
    return Column(name, type_, nullable=nullable, primary_key=False)


def _pk(name: str = "id") -> Column:
    return Column(name, ColumnType.INTEGER, nullable=False, primary_key=True)


def test_owned_tables_includes_business_and_every_table_with_a_business_id_column() -> None:
    business = Table("business", (_pk(), _col("name", ColumnType.TEXT)), ())
    customer = Table(
        "customer",
        (_pk(), _col("business_id"), _col("name", ColumnType.TEXT)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    login_guard = Table("login_guard", (_col("email", ColumnType.TEXT, nullable=False),), ())
    schema = Schema((business, customer, login_guard))

    found = {table.name for table in owned_tables(schema)}

    assert found == {"business", "customer"}


def test_unowned_tables_reports_a_table_with_no_business_id_that_is_not_platform_or_skipped() -> (
    None
):
    business = Table("business", (_pk(),), ())
    orphan = Table("orphan", (_pk(), _col("note", ColumnType.TEXT)), ())
    schema = Schema((business, orphan))

    assert unowned_tables(schema) == ("orphan",)


def test_unowned_tables_is_empty_when_every_table_is_owned_platform_or_skipped() -> None:
    business = Table("business", (_pk(),), ())
    login_guard = Table("login_guard", (_col("email", ColumnType.TEXT),), ())
    alembic_version = Table("alembic_version", (_col("version_num", ColumnType.TEXT),), ())
    schema = Schema((business, login_guard, alembic_version))

    assert unowned_tables(schema) == ()


@pytest.mark.parametrize(
    "name",
    [
        "secret_token",
        "api_token",
        "password_hash",
        "token_digest",
        "credentials",
        "encrypted_blob",
        "ciphertext",
        "telegram_api_key",
        "service_private_key",
        "webhook_secret_key",
    ],
)
def test_looks_secret_flags_a_secret_like_column_name(name: str) -> None:
    assert looks_secret(name) is True


@pytest.mark.parametrize("name", ["name_key", "id", "business_id", "note", "key"])
def test_looks_secret_does_not_flag_an_ordinary_column_name(name: str) -> None:
    assert looks_secret(name) is False


def test_secret_columns_reports_an_unexcluded_secret_like_column() -> None:
    business = Table("business", (_pk(),), ())
    leaky = Table(
        "leaky",
        (_pk(), _col("business_id"), _col("bot_token", ColumnType.TEXT)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    schema = Schema((business, leaky))

    assert secret_columns(schema) == (("leaky", "bot_token"),)


def test_secret_columns_is_empty_once_the_column_is_excluded_or_its_table_withheld() -> None:
    business = Table("business", (_pk(),), ())
    app_user = Table(
        "app_user",
        (_pk(), _col("business_id"), _col("password_hash", ColumnType.TEXT)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    invitation = Table(
        "invitation",
        (_pk(), _col("business_id", nullable=True), _col("token_digest", ColumnType.TEXT)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    schema = Schema((business, app_user, invitation))

    assert secret_columns(schema) == ()


def test_delete_order_puts_a_child_before_the_table_it_references() -> None:
    business = Table("business", (_pk(),), ())
    variety = Table(
        "variety",
        (_pk(), _col("business_id")),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    stock_entry = Table(
        "stock_entry",
        (_pk(), _col("business_id"), _col("variety_id")),
        (
            ForeignKey(("business_id",), "business", ("id",)),
            ForeignKey(("variety_id",), "variety", ("id",)),
        ),
    )
    schema = Schema((business, variety, stock_entry))

    order = delete_order(schema)

    assert order.index("stock_entry") < order.index("variety") < order.index("business")


def test_delete_order_treats_a_composite_foreign_key_as_one_edge() -> None:
    business = Table("business", (_pk(),), ())
    category = Table(
        "expense_category",
        (_pk(), _col("business_id")),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    expense = Table(
        "expense",
        (_pk(), _col("business_id"), _col("category_id")),
        (
            ForeignKey(("business_id",), "business", ("id",)),
            ForeignKey(("business_id", "category_id"), "expense_category", ("business_id", "id")),
        ),
    )
    schema = Schema((business, category, expense))

    order = delete_order(schema)

    assert order.index("expense") < order.index("expense_category") < order.index("business")


def test_delete_order_refuses_a_cycle_and_names_the_tables_in_it() -> None:
    business = Table("business", (_pk(),), ())
    a = Table(
        "a",
        (_pk(), _col("business_id"), _col("b_id")),
        (
            ForeignKey(("business_id",), "business", ("id",)),
            ForeignKey(("b_id",), "b", ("id",)),
        ),
    )
    b = Table(
        "b",
        (_pk(), _col("business_id"), _col("a_id")),
        (
            ForeignKey(("business_id",), "business", ("id",)),
            ForeignKey(("a_id",), "a", ("id",)),
        ),
    )
    schema = Schema((business, a, b))

    with pytest.raises(DeleteOrderCycle) as raised:
        delete_order(schema)

    assert raised.value.tables == ("a", "b", "business")


def test_other_type_columns_reports_an_unexcluded_other_typed_column() -> None:
    business = Table("business", (_pk(),), ())
    oddity = Table(
        "oddity",
        (_pk(), _col("business_id"), _col("blob", ColumnType.OTHER)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    schema = Schema((business, oddity))

    assert other_type_columns(schema) == (("oddity", "blob"),)


def test_other_type_columns_excludes_the_pinned_catalog_token_ciphertext() -> None:
    business = Table("business", (_pk(),), ())
    pinned_catalog = Table(
        "pinned_catalog",
        (_pk(), _col("business_id"), _col("token_ciphertext", ColumnType.OTHER)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    schema = Schema((business, pinned_catalog))

    assert other_type_columns(schema) == ()


def test_delete_order_includes_invitation_even_though_its_business_id_is_nullable() -> None:
    business = Table("business", (_pk(),), ())
    invitation = Table(
        "invitation",
        (_pk(), _col("business_id", nullable=True)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    schema = Schema((business, invitation))

    order = delete_order(schema)

    assert order.index("invitation") < order.index("business")
