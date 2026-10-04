"""`Schema`, `Table`, `Column` and `ForeignKey` validate themselves in `__post_init__`
(the plan's hexagon-skeleton spec): a table reachable through them is always internally
consistent, never a shape the removal would later trip over mid-delete."""

import pytest

from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table


def _column(name: str, *, primary_key: bool = False) -> Column:
    return Column(name, ColumnType.INTEGER, nullable=False, primary_key=primary_key)


def test_a_table_looks_up_its_own_column_by_name() -> None:
    table = Table("business", (_column("id", primary_key=True), _column("name")), ())

    assert table.column("name").type is ColumnType.INTEGER
    with pytest.raises(KeyError):
        table.column("missing")


def test_a_foreign_key_pairs_the_same_number_of_columns_on_each_side() -> None:
    with pytest.raises(ValueError):
        ForeignKey(("a", "b"), "other", ("x",))


def test_a_foreign_key_names_at_least_one_column_on_each_side() -> None:
    with pytest.raises(ValueError):
        ForeignKey((), "other", ())


def test_a_table_refuses_a_foreign_key_on_a_column_it_does_not_have() -> None:
    with pytest.raises(ValueError):
        Table(
            "sale",
            (_column("id", primary_key=True),),
            (ForeignKey(("customer_id",), "customer", ("id",)),),
        )


def test_a_table_refuses_a_repeated_column_name() -> None:
    with pytest.raises(ValueError):
        Table("sale", (_column("id"), _column("id")), ())


def test_a_table_needs_at_least_one_column() -> None:
    with pytest.raises(ValueError):
        Table("sale", (), ())


def test_a_schema_looks_up_a_table_by_name_and_refuses_a_repeated_one() -> None:
    table = Table("business", (_column("id", primary_key=True),), ())
    schema = Schema((table,))

    assert schema.table("business") is table
    with pytest.raises(KeyError):
        schema.table("missing")
    with pytest.raises(ValueError):
        Schema((table, table))
