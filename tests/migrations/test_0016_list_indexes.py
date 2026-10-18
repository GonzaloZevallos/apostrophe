"""Migration 0016 adds the three indexes the Ventas list needs (ADR-0038) and takes
them away again, never touching a row: every `sale`, `sale_line` and `payment` row of
two businesses survives both directions, over a plain sqlite file and a libsql one
(ADR-0016)."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

NOW = "2026-01-01 12:00:00"
INDEXES = {
    "sale": "ix_sale_business_id_sale_date",
    "sale_line": "ix_sale_line_sale_id",
    "payment": "ix_payment_sale_id",
}
TABLES = ("sale", "sale_line", "payment")


def _migrate(engine: Engine, direction: str, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            if direction == "up":
                command.upgrade(config, revision)
            else:
                command.downgrade(config, revision)


def _seed(engine: Engine) -> None:
    """Two businesses, each with three sales of several lines: two paid on the spot,
    one owing, plus a later payment (no sale) of its customer."""
    with engine.begin() as connection:
        for business in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name) VALUES (:b, :name)"),
                {"b": business, "name": f"Negocio {business}"},
            )
            connection.execute(
                text(
                    "INSERT INTO customer (id, business_id, name, phone, vip) "
                    "VALUES (:b, :b, :name, :phone, 0)"
                ),
                {"b": business, "name": f"Cliente {business}", "phone": f"11 0000-000{business}"},
            )
            connection.execute(
                text(
                    "INSERT INTO variety (id, business_id, name, name_key) "
                    "VALUES (:b, :b, :name, :name)"
                ),
                {"b": business, "name": f"gelato {business}"},
            )
            for number in (1, 2, 3):
                sale_id = business * 10 + number
                connection.execute(
                    text(
                        "INSERT INTO sale (id, business_id, sale_date, customer_id, "
                        "shipping_charged, recorded_at) "
                        "VALUES (:id, :b, :day, :b, 0, :now)"
                    ),
                    {"id": sale_id, "b": business, "day": f"2026-01-0{number}", "now": NOW},
                )
                for position in range(3):
                    connection.execute(
                        text(
                            "INSERT INTO sale_line (id, business_id, sale_id, variety_id, "
                            "grams_hundredths, pricing_rule, price_per_gram, line_total, "
                            "position) VALUES (:id, :b, :sale, :b, 500, 'list', 10000, "
                            "50000, :position)"
                        ),
                        {
                            "id": sale_id * 10 + position,
                            "b": business,
                            "sale": sale_id,
                            "position": position,
                        },
                    )
                if number < 3:
                    connection.execute(
                        text(
                            "INSERT INTO payment (id, business_id, paid_on, amount, method, "
                            "customer_id, sale_id, recorded_at) VALUES (:id, :b, :day, "
                            "150000, 'cash', :b, :sale, :now)"
                        ),
                        {
                            "id": sale_id,
                            "b": business,
                            "day": f"2026-01-0{number}",
                            "sale": sale_id,
                            "now": NOW,
                        },
                    )
            connection.execute(
                text(
                    "INSERT INTO payment (id, business_id, paid_on, amount, method, "
                    "customer_id, sale_id, recorded_at) VALUES (:id, :b, '2026-01-05', "
                    "50000, 'transfer', :b, NULL, :now)"
                ),
                {"id": business * 100, "b": business, "now": NOW},
            )


def _rows(engine: Engine) -> dict[str, list[tuple[object, ...]]]:
    with engine.connect() as connection:
        return {
            table: [
                tuple(row) for row in connection.execute(text(f"SELECT * FROM {table} ORDER BY id"))
            ]
            for table in TABLES
        }


def _index_names(engine: Engine) -> dict[str, set[str]]:
    inspector = inspect(engine)
    return {
        table: {str(index["name"]) for index in inspector.get_indexes(table)} for table in TABLES
    }


def _walk(engine: Engine) -> None:
    _migrate(engine, "up", "0015")
    _seed(engine)
    before = _rows(engine)
    assert [len(rows) for rows in before.values()] == [6, 18, 6]
    assert all(INDEXES[table] not in names for table, names in _index_names(engine).items())

    upgrade_to_head(engine)

    assert _rows(engine) == before
    assert all(INDEXES[table] in names for table, names in _index_names(engine).items())
    columns = {
        table: [index["column_names"] for index in inspect(engine).get_indexes(table)]
        for table in TABLES
    }
    assert ["business_id", "sale_date"] in columns["sale"]
    assert ["sale_id"] in columns["sale_line"]
    assert ["sale_id"] in columns["payment"]

    _migrate(engine, "down", "0015")

    assert _rows(engine) == before
    assert all(INDEXES[table] not in names for table, names in _index_names(engine).items())

    upgrade_to_head(engine)
    assert _rows(engine) == before
    assert all(INDEXES[table] in names for table, names in _index_names(engine).items())


def test_upgrade_downgrade_and_upgrade_again_keep_every_row_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_upgrade_downgrade_and_upgrade_again_keep_every_row_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()
