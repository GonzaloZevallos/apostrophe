"""Migration 0012 adds `variety.archived_at` and drops it again, with a native ADD and
DROP COLUMN (no table rebuild): every row of `variety` and of the five tables that
reference it survives both directions, on the plain sqlite and the libsql file drivers
(ADR-0016)."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT

NOW = "2026-01-01 12:00:00"
REFERENCING = ("price_entry", "stock_entry", "stock_threshold", "catalog_attributes", "sale_line")

STATEMENTS = [
    "INSERT INTO business (id, name) VALUES (1, 'Uno')",
    "INSERT INTO variety (id, business_id, name, name_key) VALUES (1, 1, 'Gold', 'gold')",
    "INSERT INTO variety (id, business_id, name, name_key) VALUES (2, 1, 'Silver', 'silver')",
    "INSERT INTO price_entry (id, business_id, variety_id, effective_from, list_price) "
    "VALUES (1, 1, 1, '2026-01-01', 11000)",
    "INSERT INTO stock_entry "
    "(id, business_id, entry_date, variety_id, origin, grams_hundredths, recorded_at) "
    f"VALUES (1, 1, '2026-01-01', 1, 'opening_stock', 1200, '{NOW}')",
    "INSERT INTO stock_threshold (id, business_id, variety_id, threshold_hundredths) "
    "VALUES (1, 1, 1, 500)",
    "INSERT INTO catalog_attributes (id, business_id, variety_id, shown) VALUES (1, 1, 1, 1)",
    "INSERT INTO sale (id, business_id, sale_date, shipping_charged, recorded_at) "
    f"VALUES (1, 1, '2026-01-01', 0, '{NOW}')",
    "INSERT INTO sale_line "
    "(id, business_id, sale_id, variety_id, grams_hundredths, pricing_rule, price_per_gram, "
    "line_total, position) VALUES (1, 1, 1, 1, 1000, 'list', 11000, 110000, 0)",
]


def _engine(driver: str, tmp_path: Path) -> Engine:
    if driver == "sqlite+libsql":
        pytest.importorskip("sqlalchemy_libsql")
    return make_engine(f"{driver}:///{tmp_path / 'apostrophe.db'}")


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


def _columns(engine: Engine) -> list[str]:
    return [column["name"] for column in inspect(engine).get_columns("variety")]


def _counts(engine: Engine) -> dict[str, int]:
    with engine.connect() as connection:
        return {
            table: connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            for table in ("variety", *REFERENCING)
        }


def _assert_foreign_keys_whole(engine: Engine) -> None:
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        assert dbapi_connection.execute("PRAGMA foreign_key_check").fetchall() == []


@pytest.mark.parametrize("driver", ["sqlite", "sqlite+libsql"])
def test_0012_adds_and_drops_archived_at_keeping_every_row(driver: str, tmp_path: Path) -> None:
    engine = _engine(driver, tmp_path)
    _migrate(engine, "up", "0011")
    assert "archived_at" not in _columns(engine)
    with engine.begin() as connection:
        for statement in STATEMENTS:
            connection.execute(text(statement))
    seeded = _counts(engine)
    assert seeded == {"variety": 2, **dict.fromkeys(REFERENCING, 1)}

    _migrate(engine, "up", "0012")

    assert "archived_at" in _columns(engine)
    assert _counts(engine) == seeded
    with engine.connect() as connection:
        archived = connection.execute(
            text("SELECT COUNT(*) FROM variety WHERE archived_at IS NOT NULL")
        ).scalar_one()
    assert archived == 0
    _assert_foreign_keys_whole(engine)

    _migrate(engine, "down", "0011")

    assert "archived_at" not in _columns(engine)
    assert _counts(engine) == seeded
    _assert_foreign_keys_whole(engine)
    engine.dispose()
