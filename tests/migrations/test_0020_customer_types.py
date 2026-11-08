"""Migration 0020 adds customer types (docs/adr/0059, docs/adr/0070): through the real
`upgrade_to_head` from 0019, over the plain sqlite driver and sqlite+libsql (ADR-0016),
every business gets exactly one VIP type, exactly the customers with `vip` set are in
it, nobody else has a type, and the shared M3 comparator finds no changed value. The
comparator itself is fed a changed value, a gone row and a gone table it must report."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head
from tests.migrations.m3 import Snapshot, changed_values, snapshot

NOW = "2026-01-01 12:00:00"

# (id, business_id, name, phone, vip): business 1 has VIP and plain customers, business
# 2 has no VIP customer at all and must still get its VIP type (ADR-0059).
CUSTOMERS = (
    (1, 1, "Fran Araujo", "+5491123456789", 1),
    (2, 1, "Sin Numero", None, 0),
    (3, 1, "Beto", "+5491100000003", 1),
    (4, 2, "Zoe", "+5491111111111", 0),
    (5, 2, "Nadie", None, 0),
)
VIP_IDS_BY_BUSINESS = {1: {1, 3}, 2: set()}


def _config(connection: object) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_ROOT))
    config.attributes["connection"] = connection
    return config


def _migrate(engine: Engine, direction: str, revision: str) -> None:
    """Foreign keys are off while it runs, as `upgrade_to_head` does: SQLite rebuilds
    `customer` by copying it, and sales and payments point at the old copy."""
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        dbapi_connection.execute("PRAGMA foreign_keys=OFF")
        with connection.begin():
            if direction == "up":
                command.upgrade(_config(connection), revision)
            else:
                command.downgrade(_config(connection), revision)
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


def _seed(engine: Engine) -> None:
    with engine.begin() as connection:
        for business_id, name in ((1, "Uno"), (2, "Dos")):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:id, :name, 'en')"),
                {"id": business_id, "name": name},
            )
            connection.execute(
                text(
                    "INSERT INTO variety (id, business_id, name, name_key) "
                    "VALUES (:id, :id, 'Lavanda', 'lavanda')"
                ),
                {"id": business_id},
            )
        for customer_id, business_id, name, phone, vip in CUSTOMERS:
            connection.execute(
                text(
                    "INSERT INTO customer (id, business_id, name, phone, vip) "
                    "VALUES (:id, :business_id, :name, :phone, :vip)"
                ),
                {
                    "id": customer_id,
                    "business_id": business_id,
                    "name": name,
                    "phone": phone,
                    "vip": vip,
                },
            )
            connection.execute(
                text(
                    "INSERT INTO sale (id, business_id, sale_date, customer_id, "
                    "shipping_charged, recorded_at) "
                    "VALUES (:id, :business_id, '2026-01-01', :id, 0, :now)"
                ),
                {"id": customer_id, "business_id": business_id, "now": NOW},
            )
            connection.execute(
                text(
                    "INSERT INTO sale_line (id, business_id, sale_id, variety_id, "
                    "grams_hundredths, pricing_rule, price_per_gram, line_total, position) "
                    "VALUES (:id, :business_id, :id, :business_id, 100, 'list', 500, 500, 0)"
                ),
                {"id": customer_id, "business_id": business_id},
            )


def _assert_typed_as_the_vip_mark(engine: Engine) -> None:
    with engine.connect() as connection:
        types = connection.execute(
            text(
                "SELECT business_id, name, name_key, icon, is_vip FROM customer_type "
                "ORDER BY business_id"
            )
        ).all()
        members = connection.execute(
            text("SELECT id, business_id, customer_type_id, vip FROM customer ORDER BY id")
        ).all()
        type_ids = {
            row.business_id: row.id
            for row in connection.execute(text("SELECT id, business_id FROM customer_type"))
        }
    assert [tuple(row) for row in types] == [
        (1, "VIP", "vip", "star", 1),
        (2, "VIP", "vip", "star", 1),
    ]
    for row in members:
        in_vip_type = row.customer_type_id == type_ids[row.business_id]
        assert in_vip_type == bool(row.vip)
        assert row.customer_type_id is None or in_vip_type
    assert {
        business_id: {row.id for row in members if row.business_id == business_id and row.vip}
        for business_id in (1, 2)
    } == VIP_IDS_BY_BUSINESS
    assert [tuple(r) for r in members if r.customer_type_id is not None] == [
        (1, 1, type_ids[1], 1),
        (3, 1, type_ids[1], 1),
    ]


def _assert_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    assert {
        tuple(u["column_names"]): u["name"] for u in inspector.get_unique_constraints("customer")
    } == {("business_id", "phone"): "uq_customer_business_id_phone"}
    assert "ix_customer_customer_type_id" in {i["name"] for i in inspector.get_indexes("customer")}
    foreign_keys = {
        fk["name"]: (fk["referred_table"], fk["options"])
        for fk in inspector.get_foreign_keys("customer")
    }
    assert foreign_keys["fk_customer_customer_type_id_customer_type"] == ("customer_type", {})
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        assert dbapi_connection.execute("PRAGMA foreign_key_check").fetchall() == []


def _run_upgrade(url: str) -> None:
    engine = make_engine(url)
    _migrate(engine, "up", "0019")
    _seed(engine)
    before = snapshot(engine)

    upgrade_to_head(engine)

    assert changed_values(before, snapshot(engine)) == []
    _assert_typed_as_the_vip_mark(engine)
    _assert_schema(engine)
    engine.dispose()


def test_every_business_gets_its_vip_type_and_nothing_changes_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    _run_upgrade(f"sqlite:///{tmp_path / 'apostrophe.db'}")


def test_every_business_gets_its_vip_type_and_nothing_changes_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    _run_upgrade(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")


def test_a_business_has_at_most_one_vip_type_but_any_number_of_others(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _migrate(engine, "up", "0019")
    _seed(engine)
    upgrade_to_head(engine)

    with engine.begin() as connection:
        for name_key in ("regular", "mayorista"):
            connection.execute(
                text(
                    "INSERT INTO customer_type (business_id, name, name_key, icon, is_vip) "
                    "VALUES (1, :name_key, :name_key, 'circle', 0)"
                ),
                {"name_key": name_key},
            )
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO customer_type (business_id, name, name_key, icon, is_vip) "
                    "VALUES (1, 'Otro', 'otro', 'star', 1)"
                )
            )
    engine.dispose()


def test_the_downgrade_restores_the_customer_table_and_drops_the_types(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _migrate(engine, "up", "0019")
    _seed(engine)
    before = snapshot(engine)
    upgrade_to_head(engine)

    _migrate(engine, "down", "0019")

    assert changed_values(before, snapshot(engine)) == []
    inspector = inspect(engine)
    assert "customer_type" not in inspector.get_table_names()
    assert [c["name"] for c in inspector.get_columns("customer")] == [
        "id",
        "business_id",
        "name",
        "phone",
        "vip",
    ]
    engine.dispose()


def _two_rows() -> Snapshot:
    return {
        "customer": {
            (1,): {"id": 1, "name": "Fran", "vip": 1},
            (2,): {"id": 2, "name": "Beto", "vip": 0},
        },
        "sale": {(1,): {"id": 1}},
    }


def test_the_comparator_ignores_additions() -> None:
    after = _two_rows()
    after["customer"][(1,)]["customer_type_id"] = 7
    after["customer"][(3,)] = {"id": 3, "name": "Nuevo", "vip": 0}
    after["customer_type"] = {(7,): {"id": 7}}

    assert changed_values(_two_rows(), after) == []


def test_the_comparator_reports_a_changed_value_a_gone_row_and_a_gone_table() -> None:
    after = _two_rows()
    after["customer"][(1,)]["vip"] = 0
    del after["customer"][(2,)]
    del after["sale"]

    assert changed_values(_two_rows(), after) == [
        "customer[1].vip: 1 -> 0",
        "customer[2]: row gone",
        "sale: table gone",
    ]


def test_the_comparator_reports_a_gone_column() -> None:
    after = _two_rows()
    del after["customer"][(1,)]["name"]

    assert changed_values(_two_rows(), after) == ["customer[1].name: column gone"]
