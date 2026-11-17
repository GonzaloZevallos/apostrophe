"""Migration 0027 (CODING_STANDARDS §11): `catalog_attributes` becomes `catalog_attribute`
with `shown` renamed `is_shown`, and `customer.vip` becomes `is_vip`. Run through the real
revisions on a seeded database, over the plain sqlite driver and sqlite+libsql (ADR-0016):
every row survives under the new names, no foreign key is left dangling, no old name is
left in the reflected schema, and the walk down restores the 0026 schema (names included)
and the rows."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT
from tests.migrations.comparator import upgrade_to

OLD_TABLE = re.compile(r"catalog_attributes")
BARE_COLUMN = re.compile(r"^(shown|vip)$")


def _migrate(engine: Engine, direction: str, revision: str) -> None:
    """As the runner does: foreign keys off while revisions run, checked after."""
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        raw = connection.connection.dbapi_connection
        assert raw is not None
        raw.execute("PRAGMA foreign_keys=OFF")
        with connection.begin():
            if direction == "up":
                command.upgrade(config, revision)
            else:
                command.downgrade(config, revision)
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
        raw.execute("PRAGMA foreign_keys=ON")


def _seed(engine: Engine) -> None:
    """At 0026, with the old names: two businesses, each with a hidden and a shown
    attribute row and a customer with the VIP mark set and one with it unset."""
    with engine.begin() as connection:
        for business in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :name, 'en')"),
                {"b": business, "name": f"Negocio {business}"},
            )
            for offset in (0, 1):
                variety = business * 10 + offset
                connection.execute(
                    text(
                        "INSERT INTO variety (id, business_id, name, name_key) "
                        "VALUES (:id, :b, :name, :name)"
                    ),
                    {"id": variety, "b": business, "name": f"gelato {variety}"},
                )
                connection.execute(
                    text(
                        "INSERT INTO catalog_attributes (id, business_id, variety_id, shown, "
                        "emoji, indica_share, aroma) VALUES (:id, :b, :v, :shown, :emoji, "
                        ":share, :aroma)"
                    ),
                    {
                        "id": variety,
                        "b": business,
                        "v": variety,
                        "shown": offset,
                        "emoji": "🌿" if offset else None,
                        "share": 40 + variety,
                        "aroma": "citrus" if offset else None,
                    },
                )
                connection.execute(
                    text(
                        "INSERT INTO customer (id, business_id, name, phone, vip) "
                        "VALUES (:id, :b, :name, :phone, :vip)"
                    ),
                    {
                        "id": variety,
                        "b": business,
                        "name": f"Cliente {variety}",
                        "phone": f"+54 11 5555 {variety:04d}",
                        "vip": offset,
                    },
                )


def _rows(engine: Engine, sql: str) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        return [tuple(row) for row in connection.execute(text(sql))]


def _shape(engine: Engine) -> dict[str, Any]:
    """The reflected schema of the two touched tables: columns, indexes and every
    constraint, with their names."""
    inspector = inspect(engine)
    tables = sorted(
        name
        for name in inspector.get_table_names()
        if name in ("catalog_attributes", "catalog_attribute", "customer")
    )
    return {
        table: {
            "columns": [
                (c["name"], str(c["type"]), c["nullable"], c["default"])
                for c in inspector.get_columns(table)
            ],
            "pk": inspector.get_pk_constraint(table),
            "fks": sorted(
                (str(fk["name"]), fk["constrained_columns"], fk["referred_table"])
                for fk in inspector.get_foreign_keys(table)
            ),
            "uniques": sorted(
                (str(u["name"]), u["column_names"]) for u in inspector.get_unique_constraints(table)
            ),
            "indexes": sorted(
                (str(i["name"]), i["column_names"], i["unique"])
                for i in inspector.get_indexes(table)
            ),
        }
        for table in tables
    }


def _reflected_names(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    names: list[str] = []
    for table in inspector.get_table_names():
        names.append(table)
        names += [column["name"] for column in inspector.get_columns(table)]
        names += [str(index["name"]) for index in inspector.get_indexes(table)]
        names += [str(u["name"]) for u in inspector.get_unique_constraints(table)]
        names += [str(fk["name"]) for fk in inspector.get_foreign_keys(table)]
        names.append(str(inspector.get_pk_constraint(table)["name"]))
    return names


def _walk(engine: Engine) -> None:
    upgrade_to(engine, "0026")
    _seed(engine)
    attributes_before = _rows(engine, "SELECT * FROM catalog_attributes ORDER BY id")
    customers_before = _rows(engine, "SELECT * FROM customer ORDER BY id")
    shape_before = _shape(engine)
    assert [row[3] for row in attributes_before] == [0, 1, 0, 1]
    assert [row[4] for row in customers_before] == [0, 1, 0, 1]

    _migrate(engine, "up", "0027")

    assert _rows(engine, "SELECT * FROM catalog_attribute ORDER BY id") == attributes_before
    assert _rows(engine, "SELECT id, is_vip FROM customer ORDER BY id") == [
        (10, 0),
        (11, 1),
        (20, 0),
        (21, 1),
    ]
    assert _rows(engine, "SELECT id, is_shown FROM catalog_attribute ORDER BY id") == [
        (10, 0),
        (11, 1),
        (20, 0),
        (21, 1),
    ]
    names = _reflected_names(engine)
    assert [n for n in names if OLD_TABLE.search(n) or BARE_COLUMN.match(n)] == []
    shape_after = _shape(engine)
    assert shape_after["catalog_attribute"]["pk"]["name"] == "pk_catalog_attribute"
    assert shape_after["catalog_attribute"]["uniques"] == [
        ("uq_catalog_attribute_business_id_variety_id", ["business_id", "variety_id"])
    ]
    assert shape_after["catalog_attribute"]["fks"] == [
        ("fk_catalog_attribute_business_id_business", ["business_id"], "business"),
        ("fk_catalog_attribute_variety_id_variety", ["variety_id"], "variety"),
    ]

    _migrate(engine, "down", "0026")

    assert _shape(engine) == shape_before
    assert _rows(engine, "SELECT * FROM catalog_attributes ORDER BY id") == attributes_before
    assert _rows(engine, "SELECT * FROM customer ORDER BY id") == customers_before
    assert _rows(engine, "SELECT version_num FROM alembic_version") == [("0026",)]

    _migrate(engine, "up", "0027")

    assert _rows(engine, "SELECT * FROM catalog_attribute ORDER BY id") == attributes_before


def test_it_renames_the_table_and_columns_and_walks_back_whole_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_it_renames_the_table_and_columns_and_walks_back_whole_on_libsql(
    tmp_path: Path,
) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()
