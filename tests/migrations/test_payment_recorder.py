"""Migration 0035 adds two nullable columns to `payment` (who recorded it) and changes
nothing that existed: no value (the shared comparator) and no constraint or index name (a
reflection diff). Deleting the recording User clears the link and keeps the initials. The
downgrade refuses while either column is set and otherwise restores the 0034 shape."""

from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import upgrade_to, upgrade_to_head
from tests.migrations.comparator import compare, downgrade_to, snapshot

NEW_FOREIGN_KEY = (
    "fk_payment_recorded_by_app_user_id_app_user",
    ("recorded_by_app_user_id",),
    "app_user",
    ("id",),
    "SET NULL",
)
NEW_INDEX = ("ix_payment_recorded_by_app_user_id", ("recorded_by_app_user_id",), 0)


def _engine_at_0034() -> Engine:
    engine = make_engine("sqlite://")
    upgrade_to(engine, "0034")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (1, 'A', 'en')"))
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (2, 'B', 'en')"))
        connection.execute(
            text(
                "INSERT INTO app_user (id, business_id, email, password_hash) "
                "VALUES (1, 1, 'ana@example.com', 'x'), (2, 2, 'bea@example.com', 'x')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO payment_method (id, business_id, name, name_key, icon, position) "
                "VALUES (1, 1, 'Efectivo', 'efectivo', 'cash', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO customer (id, business_id, name, phone, is_vip) "
                "VALUES (1, 1, 'Ana', '+5491100000001', 0)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO sale (id, business_id, number, sold_on, customer_id, "
                "shipping_charged, recorded_at) "
                "VALUES (1, 1, 1, '2026-09-01', NULL, 0, '2026-09-01 10:00:00')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO payment (id, business_id, paid_on, amount, method, customer_id, "
                "sale_id, recorded_at, payment_method_id) VALUES "
                "(1, 1, '2026-09-02', 700, 'cash', 1, NULL, '2026-09-02 10:00:00', 1), "
                "(2, 1, '2026-09-01', 300, NULL, NULL, 1, '2026-09-01 10:00:00', 1)"
            )
        )
    return engine


def _shape(engine: Engine) -> dict[str, Any]:
    inspector = sa.inspect(engine)
    return {
        "columns": [
            (column["name"], str(column["type"]), column["nullable"])
            for column in inspector.get_columns("payment")
        ],
        "primary_key": inspector.get_pk_constraint("payment")["name"],
        "foreign_keys": {
            (
                fk["name"],
                tuple(fk["constrained_columns"]),
                fk["referred_table"],
                tuple(fk["referred_columns"]),
                fk["options"].get("ondelete"),
            )
            for fk in inspector.get_foreign_keys("payment")
        },
        "indexes": {
            (index["name"], tuple(index["column_names"]), index["unique"])
            for index in inspector.get_indexes("payment")
        },
    }


def _payments(engine: Engine) -> list[Any]:
    with engine.connect() as connection:
        return list(connection.execute(text("SELECT * FROM payment ORDER BY id")).mappings())


def test_the_upgrade_keeps_every_payment_and_adds_only_two_null_columns_a_key_and_an_index() -> (
    None
):
    engine = _engine_at_0034()
    before = snapshot(engine)
    shape = _shape(engine)

    upgrade_to_head(engine)

    compare(before, snapshot(engine))
    rows = _payments(engine)
    assert [row["id"] for row in rows] == [1, 2]
    assert all(
        row["recorded_by_initials"] is None and row["recorded_by_app_user_id"] is None
        for row in rows
    )
    after = _shape(engine)
    assert after["columns"] == [
        *shape["columns"],
        ("recorded_by_initials", "VARCHAR(32)", True),
        ("recorded_by_app_user_id", "INTEGER", True),
    ]
    assert after["primary_key"] == shape["primary_key"] == "pk_payment"
    assert after["foreign_keys"] - shape["foreign_keys"] == {NEW_FOREIGN_KEY}
    assert shape["foreign_keys"] <= after["foreign_keys"]
    assert after["indexes"] - shape["indexes"] == {NEW_INDEX}
    assert shape["indexes"] <= after["indexes"]
    inspector = sa.inspect(engine)
    assert [
        (table, fk["name"])
        for table in inspector.get_table_names()
        for fk in inspector.get_foreign_keys(table)
        if fk["referred_table"] == "payment"
    ] == []
    engine.dispose()


def test_deleting_the_recording_user_clears_the_link_and_keeps_the_initials() -> None:
    engine = _engine_at_0034()
    upgrade_to_head(engine)
    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE payment SET recorded_by_initials = 'AB', "
                "recorded_by_app_user_id = 1 WHERE id = 1"
            )
        )

    with engine.begin() as connection:
        connection.execute(text("DELETE FROM app_user WHERE id = 1"))

    first = _payments(engine)[0]
    assert (first["id"], first["recorded_by_initials"], first["recorded_by_app_user_id"]) == (
        1,
        "AB",
        None,
    )
    assert len(_payments(engine)) == 2
    engine.dispose()


@pytest.mark.parametrize(
    "assignment",
    [
        "recorded_by_initials = 'AB'",
        "recorded_by_app_user_id = 1",
        "recorded_by_initials = 'AB', recorded_by_app_user_id = 1",
    ],
)
def test_the_downgrade_refuses_while_a_recorder_is_set_and_changes_nothing(
    assignment: str,
) -> None:
    engine = _engine_at_0034()
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(text(f"UPDATE payment SET {assignment} WHERE id = 2"))
    before = snapshot(engine)
    shape = _shape(engine)

    with pytest.raises(Exception, match="no place to keep it before 0035") as refusal:
        downgrade_to(engine, "0034")

    assert "AB" not in str(refusal.value)
    assert "_new_payment" not in sa.inspect(engine).get_table_names()
    assert _shape(engine) == shape
    compare(before, snapshot(engine))
    with engine.connect() as connection:
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert version == "0035"
    engine.dispose()


def test_a_clean_downgrade_restores_the_0034_shape_and_values() -> None:
    engine = _engine_at_0034()
    shape_0034 = _shape(engine)
    before = snapshot(engine)
    upgrade_to_head(engine)

    downgrade_to(engine, "0034")

    assert _shape(engine) == shape_0034
    assert snapshot(engine) == before
    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall() == []
    engine.dispose()
