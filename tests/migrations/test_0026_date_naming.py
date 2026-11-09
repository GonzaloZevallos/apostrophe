"""Migration 0026 (CODING_STANDARDS §11, docs/adr/0077): `sale.sale_date` becomes `sold_on`
and `stock_entry.entry_date` becomes `entered_on`, and the sale index on the date is
rebuilt under the new name. Run through the real revisions on a seeded database, over the
plain sqlite driver and sqlite+libsql (ADR-0016): every row survives under the new name,
no foreign key is left dangling, no old name is left in the schema, and the walk down
restores the 0025 schema text, indexes and rows exactly."""

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

TABLES = ("sale", "sale_line", "payment", "stock_entry")
RECORDED = "2026-03-01 08:00:00"
NEW_INDEX = "ix_sale_business_id_sold_on"
OLD_NAMES = re.compile(r"(?<![a-z])(sale_date|entry_date)(?![a-z])")


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
    """At 0025, with the old names: two businesses, sales with two lines and a payment on
    the spot, and stock entries on dates that differ from each other."""
    with engine.begin() as connection:
        for business in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :name, 'en')"),
                {"b": business, "name": f"Negocio {business}"},
            )
            connection.execute(
                text(
                    "INSERT INTO variety (id, business_id, name, name_key) "
                    "VALUES (:b, :b, :name, :name)"
                ),
                {"b": business, "name": f"gelato {business}"},
            )
        sales = ((1, 1, "2026-03-10"), (2, 2, "2026-03-05"), (3, 1, "2026-02-01"))
        for sale_id, business, day in sales:
            connection.execute(
                text(
                    "INSERT INTO sale (id, business_id, sale_date, shipping_charged, "
                    "recorded_at, number) VALUES (:id, :b, :day, 0, :at, :id)"
                ),
                {"id": sale_id, "b": business, "day": day, "at": RECORDED},
            )
            for position in (0, 1):
                connection.execute(
                    text(
                        "INSERT INTO sale_line (id, business_id, sale_id, variety_id, "
                        "grams_hundredths, pricing_rule, price_per_gram, line_total, "
                        "position) VALUES (:id, :b, :sale, :b, 500, 'list', 100, 500, :p)"
                    ),
                    {"id": sale_id * 10 + position, "b": business, "sale": sale_id, "p": position},
                )
            connection.execute(
                text(
                    "INSERT INTO payment (id, business_id, paid_on, amount, method, "
                    "customer_id, sale_id, recorded_at) VALUES (:id, :b, :day, 1000, "
                    "'cash', NULL, :id, :at)"
                ),
                {"id": sale_id, "b": business, "day": day, "at": RECORDED},
            )
        entries = ((1, 1, "2026-01-15", "purchase"), (2, 1, "2026-02-20", "harvest"))
        for entry_id, business, day, origin in entries + ((3, 2, "2026-01-02", "purchase"),):
            connection.execute(
                text(
                    "INSERT INTO stock_entry (id, business_id, entry_date, variety_id, origin, "
                    "grams_hundredths, total_cost, recorded_at) "
                    "VALUES (:id, :b, :day, :b, :origin, 1000, NULL, :at)"
                ),
                {"id": entry_id, "b": business, "day": day, "origin": origin, "at": RECORDED},
            )


def _rows(engine: Engine, sql: str) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        return [tuple(row) for row in connection.execute(text(sql))]


def _all_rows(engine: Engine) -> dict[str, list[tuple[Any, ...]]]:
    """Every table's rows by position, whatever the columns are called."""
    return {table: _rows(engine, f"SELECT * FROM {table} ORDER BY id") for table in TABLES}


def _definitions(engine: Engine) -> dict[str, Any]:
    """The schema text of both tables and every index as SQLite stores and reports them."""
    return {
        "sql": _rows(
            engine,
            "SELECT name, sql FROM sqlite_master WHERE tbl_name IN ('sale', 'stock_entry') "
            "ORDER BY name",
        ),
        "indexes": {
            table: [
                (row[1], row[2], row[3], row[4], _rows(engine, f'PRAGMA index_info("{row[1]}")'))
                for row in _rows(engine, f"PRAGMA index_list({table})")
            ]
            for table in ("sale", "stock_entry")
        },
    }


def _reflected_names(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    names: list[str] = []
    for table in inspector.get_table_names():
        names.append(table)
        names += [column["name"] for column in inspector.get_columns(table)]
        names += [str(index["name"]) for index in inspector.get_indexes(table)]
    return names


def _walk(engine: Engine) -> None:
    upgrade_to(engine, "0025")
    _seed(engine)
    rows_before = _all_rows(engine)
    shape_before = _definitions(engine)
    assert [len(rows) for rows in rows_before.values()] == [3, 6, 3, 3]
    assert len({row[2] for row in rows_before["sale"]}) == 3

    _migrate(engine, "up", "0026")

    assert _all_rows(engine) == rows_before
    assert _rows(engine, "SELECT id, sold_on FROM sale ORDER BY id") == [
        (1, "2026-03-10"),
        (2, "2026-03-05"),
        (3, "2026-02-01"),
    ]
    assert _rows(engine, "SELECT id, entered_on FROM stock_entry ORDER BY id") == [
        (1, "2026-01-15"),
        (2, "2026-02-20"),
        (3, "2026-01-02"),
    ]
    assert [name for name in _reflected_names(engine) if OLD_NAMES.search(name)] == []
    assert [row[2] for row in _rows(engine, f'PRAGMA index_info("{NEW_INDEX}")')] == [
        "business_id",
        "sold_on",
    ]

    _migrate(engine, "down", "0025")

    assert _definitions(engine) == shape_before
    assert _all_rows(engine) == rows_before
    assert _rows(engine, "SELECT version_num FROM alembic_version") == [("0025",)]

    _migrate(engine, "up", "0026")

    assert _all_rows(engine) == rows_before


def test_it_renames_the_columns_and_the_index_and_walks_back_whole_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_it_renames_the_columns_and_the_index_and_walks_back_whole_on_libsql(
    tmp_path: Path,
) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()
