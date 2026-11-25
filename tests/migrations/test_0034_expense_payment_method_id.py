"""Migration 0034 adds a nullable `expense.payment_method_id` with a same-Business RESTRICT
foreign key and an index, and changes nothing that existed: no value (the shared
comparator) and no constraint or index name (a reflection diff). The downgrade refuses
while an expense has a method and otherwise restores the 0033 shape."""

from pathlib import Path
from typing import Any

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT
from tests.migrations.comparator import (
    compare,
    downgrade_to,
    snapshot,
    upgrade_and_compare,
    upgrade_to,
)

EXPENSES: list[tuple[int, int, int, str, int, str]] = [
    # (id, business_id, expense_category_id, spent_on, amount, detail)
    (1, 1, 1, "2026-09-01", 1500, "Tierra"),
    (2, 1, 1, "2026-09-02", 250, ""),
    (3, 2, 2, "2026-09-03", 9900, "Luces"),
]

NEW_FOREIGN_KEY = (
    "fk_expense_business_id_payment_method",
    ("business_id", "payment_method_id"),
    "payment_method",
    ("business_id", "id"),
    "RESTRICT",
)
NEW_INDEX = ("ix_expense_business_id_payment_method_id", ("business_id", "payment_method_id"), 0)


def _engine_at_0033(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to(engine, "0033")
    with engine.begin() as connection:
        for business_id in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :n, 'en')"),
                {"b": business_id, "n": f"Negocio {business_id}"},
            )
            connection.execute(
                text(
                    "INSERT INTO expense_category (id, business_id, name, name_key) "
                    "VALUES (:b, :b, 'Insumos', 'insumos')"
                ),
                {"b": business_id},
            )
            connection.execute(
                text(
                    "INSERT INTO payment_method (id, business_id, name, name_key, icon, position) "
                    "VALUES (:b, :b, 'Efectivo', 'efectivo', 'cash', 1)"
                ),
                {"b": business_id},
            )
        for expense_id, business_id, category_id, spent_on, amount, detail in EXPENSES:
            connection.execute(
                text(
                    "INSERT INTO expense (id, business_id, expense_category_id, spent_on, "
                    "amount, detail, recorded_at) VALUES "
                    "(:i, :b, :c, :s, :a, :d, '2026-09-04 10:00:00')"
                ),
                {
                    "i": expense_id,
                    "b": business_id,
                    "c": category_id,
                    "s": spent_on,
                    "a": amount,
                    "d": detail,
                },
            )
    return engine


def _shape(engine: Engine) -> dict[str, Any]:
    """What reflection says `expense` is: columns in order, the pk name, foreign keys and
    indexes with their names."""
    inspector = sa.inspect(engine)
    return {
        "columns": [
            (column["name"], str(column["type"]), column["nullable"])
            for column in inspector.get_columns("expense")
        ],
        "primary_key": inspector.get_pk_constraint("expense")["name"],
        "foreign_keys": {
            (
                fk["name"],
                tuple(fk["constrained_columns"]),
                fk["referred_table"],
                tuple(fk["referred_columns"]),
                fk["options"].get("ondelete"),
            )
            for fk in inspector.get_foreign_keys("expense")
        },
        "indexes": {
            (index["name"], tuple(index["column_names"]), index["unique"])
            for index in inspector.get_indexes("expense")
        },
    }


def _pragma(engine: Engine, name: str) -> Any:
    with engine.connect() as connection:
        return connection.exec_driver_sql(f"PRAGMA {name}").fetchall()


def test_every_expense_keeps_every_value_and_has_no_payment_method(tmp_path: Path) -> None:
    engine = _engine_at_0033(tmp_path)

    after = upgrade_and_compare(engine, "0034")

    assert sorted(after["expense"]) == [(1,), (2,), (3,)]
    assert all(row["payment_method_id"] is None for row in after["expense"].values())
    engine.dispose()


def test_the_comparator_would_catch_a_migration_that_rewrote_an_expense(tmp_path: Path) -> None:
    engine = _engine_at_0033(tmp_path)
    before = snapshot(engine)
    upgrade_to(engine, "0034")
    with engine.begin() as connection:
        connection.execute(text("UPDATE expense SET amount = 1 WHERE id = 1"))

    with pytest.raises(AssertionError, match="amount"):
        compare(before, snapshot(engine))
    engine.dispose()


def test_the_upgrade_adds_only_the_column_the_foreign_key_and_the_index(tmp_path: Path) -> None:
    engine = _engine_at_0033(tmp_path)
    before = _shape(engine)

    upgrade_to(engine, "0034")

    after = _shape(engine)
    assert after["columns"] == [*before["columns"], ("payment_method_id", "INTEGER", True)]
    assert after["primary_key"] == before["primary_key"] == "pk_expense"
    assert after["foreign_keys"] - before["foreign_keys"] == {NEW_FOREIGN_KEY}
    assert before["foreign_keys"] <= after["foreign_keys"]
    assert after["indexes"] - before["indexes"] == {NEW_INDEX}
    assert before["indexes"] <= after["indexes"]
    engine.dispose()


def test_the_method_key_it_points_at_exists_and_no_reference_is_left_broken(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0033(tmp_path)

    upgrade_to(engine, "0034")

    uniques = sa.inspect(engine).get_unique_constraints("payment_method")
    assert "uq_payment_method_business_id_id" in {unique["name"] for unique in uniques}
    assert _pragma(engine, "foreign_key_check") == []
    engine.dispose()


def test_the_foreign_key_refuses_a_method_of_another_business_and_restricts_its_removal(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0033(tmp_path)
    upgrade_to(engine, "0034")
    engine.dispose()  # the migration connection may have left enforcement off; start fresh

    with engine.begin() as connection:
        connection.execute(text("UPDATE expense SET payment_method_id = 1 WHERE id = 1"))
    with pytest.raises(sa.exc.IntegrityError), engine.begin() as connection:
        connection.execute(text("UPDATE expense SET payment_method_id = 2 WHERE id = 1"))
    with pytest.raises(sa.exc.IntegrityError), engine.begin() as connection:
        connection.execute(text("DELETE FROM payment_method WHERE id = 1"))
    engine.dispose()


def test_the_downgrade_refuses_while_an_expense_has_a_method_and_changes_nothing(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0033(tmp_path)
    upgrade_to(engine, "0034")
    with engine.begin() as connection:
        connection.execute(text("UPDATE expense SET payment_method_id = 1 WHERE id = 2"))
    before = snapshot(engine)
    shape = _shape(engine)

    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        raw = connection.connection.dbapi_connection
        assert raw is not None
        foreign_keys = raw.execute("PRAGMA foreign_keys").fetchall()
        with (
            pytest.raises(Exception, match="no place to keep it before 0034"),
            connection.begin(),
        ):
            command.downgrade(config, "0033")
        assert raw.execute("PRAGMA foreign_keys").fetchall() == foreign_keys

    with engine.connect() as connection:
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert revision == "0034"
    assert _shape(engine) == shape
    compare(before, snapshot(engine))
    engine.dispose()


def test_a_clean_downgrade_restores_the_0033_shape_and_values(tmp_path: Path) -> None:
    engine = _engine_at_0033(tmp_path)
    shape_0033 = _shape(engine)
    before = snapshot(engine)
    upgrade_to(engine, "0034")

    downgrade_to(engine, "0033")

    assert _shape(engine) == shape_0033
    assert snapshot(engine) == before
    assert _pragma(engine, "foreign_key_check") == []
    engine.dispose()
