"""Migration 0011 makes `customer.phone` nullable (ADR-0021): every existing phone
survives the real `upgrade_to_head` from 0010 unchanged, over both the plain sqlite
driver and sqlite+libsql (ADR-0016), and no foreign key is left dangling."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

NOW = "2026-01-01 12:00:00"


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def _insert_business(engine: Engine, business_id: int, name: str, *, at_head: bool = False) -> None:
    """At an older revision the column `language` does not exist yet."""
    columns = "id, name, language" if at_head else "id, name"
    values = ":id, :name, 'en'" if at_head else ":id, :name"
    with engine.begin() as connection:
        connection.execute(
            text(f"INSERT INTO business ({columns}) VALUES ({values})"),
            {"id": business_id, "name": name},
        )


def _insert_customer(
    engine: Engine, customer_id: int, business_id: int, name: str, phone: str
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO customer (id, business_id, name, phone, vip) "
                "VALUES (:id, :business_id, :name, :phone, 0)"
            ),
            {"id": customer_id, "business_id": business_id, "name": name, "phone": phone},
        )


def _insert_sale(engine: Engine, sale_id: int, business_id: int, customer_id: int) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO sale "
                "(id, business_id, sale_date, customer_id, shipping_charged, recorded_at) "
                "VALUES (:id, :business_id, '2026-01-01', :customer_id, 0, :now)"
            ),
            {"id": sale_id, "business_id": business_id, "customer_id": customer_id, "now": NOW},
        )


def _insert_payment(
    engine: Engine,
    payment_id: int,
    business_id: int,
    customer_id: int,
    sale_id: int | None,
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO payment "
                "(id, business_id, paid_on, amount, method, customer_id, sale_id, recorded_at) "
                "VALUES (:id, :business_id, '2026-01-02', 1000, 'cash', :customer_id, "
                ":sale_id, :now)"
            ),
            {
                "id": payment_id,
                "business_id": business_id,
                "customer_id": customer_id,
                "sale_id": sale_id,
                "now": NOW,
            },
        )


def _seed(engine: Engine) -> None:
    """Two businesses, each with a customer keeping their own phone, a sale, an
    on-the-spot payment (its own `sale_id`) and a later payment (`sale_id` null)."""
    _insert_business(engine, 1, "Uno")
    _insert_business(engine, 2, "Dos")
    _insert_customer(engine, 1, 1, "Fran Araujo", "+5491123456789")
    _insert_customer(engine, 2, 2, "Zoe", "+5491111111111")
    _insert_sale(engine, 1, 1, 1)
    _insert_sale(engine, 2, 2, 2)
    _insert_payment(engine, 1, 1, 1, sale_id=1)  # on the spot
    _insert_payment(engine, 2, 2, 2, sale_id=None)  # later


def _assert_migrated_whole(engine: Engine) -> None:
    with Session(engine) as session:
        phones = session.execute(text("SELECT id, phone FROM customer ORDER BY id")).all()
        assert [(row.id, row.phone) for row in phones] == [
            (1, "+5491123456789"),
            (2, "+5491111111111"),
        ]

        joined_sales = session.execute(
            text(
                "SELECT sale.id, customer.name FROM sale "
                "JOIN customer ON customer.id = sale.customer_id ORDER BY sale.id"
            )
        ).all()
        assert [row.name for row in joined_sales] == ["Fran Araujo", "Zoe"]

        joined_payments = session.execute(
            text(
                "SELECT payment.id, customer.name FROM payment "
                "JOIN customer ON customer.id = payment.customer_id ORDER BY payment.id"
            )
        ).all()
        assert [row.name for row in joined_payments] == ["Fran Araujo", "Zoe"]

    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        broken = dbapi_connection.execute("PRAGMA foreign_key_check").fetchall()
        assert broken == []


def test_existing_phones_survive_the_upgrade_on_plain_sqlite(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0010")
    _seed(engine)

    upgrade_to_head(engine)

    _assert_migrated_whole(engine)
    engine.dispose()


def test_existing_phones_survive_the_upgrade_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _upgrade_to(engine, "0010")
    _seed(engine)

    upgrade_to_head(engine)

    _assert_migrated_whole(engine)
    engine.dispose()


def test_the_unique_constraint_still_carries_its_name(tmp_path: Path) -> None:
    from sqlalchemy import inspect

    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)

    inspector = inspect(engine)
    assert [c["name"] for c in inspector.get_unique_constraints("customer")] == [
        "uq_customer_business_phone"
    ]
    engine.dispose()


def test_two_customers_with_no_phone_coexist_after_the_upgrade(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    _insert_business(engine, 1, "Uno", at_head=True)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO customer (id, business_id, name, phone, vip) "
                "VALUES (1, 1, 'Primero', NULL, 0)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO customer (id, business_id, name, phone, vip) "
                "VALUES (2, 1, 'Segundo', NULL, 0)"
            )
        )
    with Session(engine) as session:
        count = session.execute(
            text("SELECT COUNT(*) FROM customer WHERE phone IS NULL")
        ).scalar_one()
        assert count == 2
    engine.dispose()


def test_downgrade_fails_loudly_on_a_null_phone(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    _insert_business(engine, 1, "Uno", at_head=True)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO customer (id, business_id, name, phone, vip) "
                "VALUES (1, 1, 'Sin Numero', NULL, 0)"
            )
        )

    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with pytest.raises(RuntimeError):
            with connection.begin():
                command.downgrade(config, "0010")
    engine.dispose()
