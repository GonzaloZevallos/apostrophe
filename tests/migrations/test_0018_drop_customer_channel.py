"""Migration 0018 drops `customer.channel` for good (ADR-0047): through the real
`upgrade_to_head` from 0017, over the plain sqlite driver and sqlite+libsql (ADR-0016),
the column is gone and every other customer column, sale, line and payment row, and every
debtor's balance, is exactly as it was. The downgrade gives back an empty column."""

from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

NOW = "2026-01-01 12:00:00"

# (id, business_id, name, phone, vip, channel): with and without a phone, VIP and not,
# some with a value in the old column and some without.
CUSTOMERS = (
    (1, 1, "Fran Araujo", "+5491123456789", 1, "wa"),
    (2, 1, "Sin Numero", None, 0, "ig"),
    (3, 1, "Beto", "+5491100000003", 0, None),
    (4, 2, "Zoe", "+5491111111111", 0, "tg"),
    (5, 2, "Nadie", None, 1, None),
)
OTHER_TABLES = ("sale", "sale_line", "payment")


def _config(connection: object) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_ROOT))
    config.attributes["connection"] = connection
    return config


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        with connection.begin():
            command.upgrade(_config(connection), revision)


def _seed(engine: Engine) -> None:
    """Two businesses; sales with lines, an on-the-spot payment (its own `sale_id`) and
    later payments (`sale_id` null), so some customers owe and some are in credit."""
    with engine.begin() as connection:
        for business_id, name in ((1, "Uno"), (2, "Dos")):
            connection.execute(
                text("INSERT INTO business (id, name) VALUES (:id, :name)"),
                {"id": business_id, "name": name},
            )
        for customer_id, business_id, name, phone, vip, channel in CUSTOMERS:
            connection.execute(
                text(
                    "INSERT INTO customer (id, business_id, name, phone, vip, channel) "
                    "VALUES (:id, :business_id, :name, :phone, :vip, :channel)"
                ),
                {
                    "id": customer_id,
                    "business_id": business_id,
                    "name": name,
                    "phone": phone,
                    "vip": vip,
                    "channel": channel,
                },
            )
        for variety_id, business_id in ((1, 1), (2, 2)):
            connection.execute(
                text(
                    "INSERT INTO variety (id, business_id, name, name_key) "
                    "VALUES (:id, :business_id, 'Lavanda', 'lavanda')"
                ),
                {"id": variety_id, "business_id": business_id},
            )
        # (sale id, business, customer, shipping, variety, line total)
        for sale_id, business_id, customer_id, shipping, variety_id, total in (
            (1, 1, 1, 0, 1, 5000),
            (2, 1, 2, 300, 1, 8000),
            (3, 1, 3, 0, 1, 2000),
            (4, 2, 4, 100, 2, 6000),
            (5, 2, 5, 0, 2, 1000),
        ):
            connection.execute(
                text(
                    "INSERT INTO sale "
                    "(id, business_id, sale_date, customer_id, shipping_charged, recorded_at) "
                    "VALUES (:id, :business_id, '2026-01-01', :customer_id, :shipping, :now)"
                ),
                {
                    "id": sale_id,
                    "business_id": business_id,
                    "customer_id": customer_id,
                    "shipping": shipping,
                    "now": NOW,
                },
            )
            connection.execute(
                text(
                    "INSERT INTO sale_line (id, business_id, sale_id, variety_id, "
                    "grams_hundredths, pricing_rule, price_per_gram, line_total, position) "
                    "VALUES (:id, :business_id, :id, :variety_id, 100, 'list', :total, "
                    ":total, 0)"
                ),
                {
                    "id": sale_id,
                    "business_id": business_id,
                    "variety_id": variety_id,
                    "total": total,
                },
            )
        # (payment id, business, customer, sale id, amount)
        payments: tuple[tuple[int, int, int, int | None, int], ...] = (
            (1, 1, 1, 1, 5000),  # on the spot, settles the sale
            (2, 1, 2, None, 3000),  # later, part
            (3, 2, 4, None, 7000),  # later, more than owed: in credit
            (4, 2, 5, None, 400),  # later, part
        )
        for payment_id, business_id, customer_id, paid_sale_id, amount in payments:
            connection.execute(
                text(
                    "INSERT INTO payment (id, business_id, paid_on, amount, method, "
                    "customer_id, sale_id, recorded_at) "
                    "VALUES (:id, :business_id, '2026-01-02', :amount, 'cash', "
                    ":customer_id, :sale_id, :now)"
                ),
                {
                    "id": payment_id,
                    "business_id": business_id,
                    "customer_id": customer_id,
                    "sale_id": paid_sale_id,
                    "amount": amount,
                    "now": NOW,
                },
            )


def _snapshot(engine: Engine) -> dict[str, list[tuple[Any, ...]]]:
    """Everything that must survive: the customer's columns but the channel, the rows of
    the other tables, and each customer's balance (sold with shipping minus paid)."""
    with engine.connect() as connection:
        snapshot: dict[str, list[tuple[Any, ...]]] = {
            "customer": [
                tuple(row)
                for row in connection.execute(
                    text("SELECT id, business_id, name, phone, vip FROM customer ORDER BY id")
                )
            ]
        }
        for table in OTHER_TABLES:
            snapshot[table] = [
                tuple(row) for row in connection.execute(text(f"SELECT * FROM {table} ORDER BY id"))
            ]
        snapshot["balance"] = [
            tuple(row)
            for row in connection.execute(
                text(
                    "SELECT customer.id, "
                    "COALESCE((SELECT SUM(sale_line.line_total) FROM sale_line "
                    "JOIN sale ON sale.id = sale_line.sale_id "
                    "WHERE sale.customer_id = customer.id), 0) "
                    "+ COALESCE((SELECT SUM(shipping_charged) FROM sale "
                    "WHERE sale.customer_id = customer.id), 0) "
                    "- COALESCE((SELECT SUM(amount) FROM payment "
                    "WHERE payment.customer_id = customer.id), 0) "
                    "FROM customer ORDER BY customer.id"
                )
            )
        ]
        return snapshot


def _assert_dropped_and_whole(engine: Engine) -> None:
    columns = [column["name"] for column in inspect(engine).get_columns("customer")]
    assert columns == ["id", "business_id", "name", "phone", "vip"]
    assert [name for name in inspect(engine).get_unique_constraints("customer")] == [
        {"name": "uq_customer_business_phone", "column_names": ["business_id", "phone"]}
    ]
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        assert dbapi_connection.execute("PRAGMA foreign_key_check").fetchall() == []


def _run_upgrade(url: str) -> None:
    engine = make_engine(url)
    _upgrade_to(engine, "0017")
    _seed(engine)
    before = _snapshot(engine)
    assert any(balance > 0 for _, balance in before["balance"])
    assert any(balance < 0 for _, balance in before["balance"])

    upgrade_to_head(engine)

    assert _snapshot(engine) == before
    _assert_dropped_and_whole(engine)
    engine.dispose()


def test_the_column_is_gone_and_all_else_whole_on_plain_sqlite(tmp_path: Path) -> None:
    _run_upgrade(f"sqlite:///{tmp_path / 'apostrophe.db'}")


def test_the_column_is_gone_and_all_else_whole_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    _run_upgrade(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")


def test_the_downgrade_gives_back_an_empty_nullable_column(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0017")
    _seed(engine)
    before = _snapshot(engine)
    upgrade_to_head(engine)

    with engine.connect() as connection:
        with connection.begin():
            command.downgrade(_config(connection), "0017")

    column = next(c for c in inspect(engine).get_columns("customer") if c["name"] == "channel")
    assert column["nullable"] is True
    assert str(column["type"]) == "VARCHAR(16)"
    with engine.connect() as connection:
        channels = connection.execute(text("SELECT channel FROM customer")).scalars().all()
    assert channels == [None] * len(CUSTOMERS)
    assert _snapshot(engine) == before
    engine.dispose()
