"""Migration 0031 adds the two nullable `sale_line` columns that record the customer type
and a copy of its name (docs/adr/0059). It changes no value that existed (the shared
comparator over a seeded database walked through every earlier revision), and the lines
that existed read back with no type."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import upgrade_to
from tests.migrations import m3_seed
from tests.migrations.comparator import compare, snapshot


def _seeded_at_0030() -> Engine:
    engine = make_engine("sqlite://")
    upgrade_to(engine, "0019")
    with engine.begin() as connection:
        m3_seed.SEED_INCREMENTS["0019"](connection)
    upgrade_to(engine, "0030")
    return engine


def test_it_changes_no_value_that_existed_and_the_new_columns_are_empty() -> None:
    engine = _seeded_at_0030()

    before = snapshot(engine)
    upgrade_to(engine, "0031")
    after = snapshot(engine)
    compare(before, after)

    assert after["sale_line"]
    for row in after["sale_line"].values():
        assert row["customer_type_id"] is None
        assert row["customer_type_name"] is None


def test_the_columns_are_nullable_and_the_type_id_has_no_foreign_key() -> None:
    engine = _seeded_at_0030()

    upgrade_to(engine, "0031")

    inspector = inspect(engine)
    columns = {column["name"]: column for column in inspector.get_columns("sale_line")}
    assert columns["customer_type_id"]["nullable"] is True
    assert columns["customer_type_name"]["nullable"] is True
    assert str(columns["customer_type_name"]["type"]) == "VARCHAR(40)"
    referred = {
        column
        for key in inspector.get_foreign_keys("sale_line")
        for column in key["constrained_columns"]
    }
    assert "customer_type_id" not in referred


def test_a_type_can_be_deleted_without_touching_a_recorded_line() -> None:
    engine = _seeded_at_0030()
    upgrade_to(engine, "0031")
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE sale_line SET customer_type_id = 7, customer_type_name = 'Mayorista'")
        )
        connection.execute(text("DELETE FROM customer_type_price"))
        connection.execute(text("UPDATE customer SET customer_type_id = NULL"))
        connection.execute(text("DELETE FROM customer_type"))

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT customer_type_id, customer_type_name FROM sale_line")
        ).all()
    assert rows
    assert all(tuple(row) == (7, "Mayorista") for row in rows)
