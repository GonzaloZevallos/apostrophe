"""Migration 0013 adds `variety.archived_at` (ADR-0032) with a native ADD COLUMN and
takes it away with a native DROP COLUMN, never a table rebuild: every row of the five
tables that reference `variety` survives both directions, over a plain sqlite file and
a libsql one (ADR-0016), and the downgrade refuses while any variety is archived."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

NOW = "2026-01-01 12:00:00"
REFERENCING = ("price_entry", "sale_line", "stock_entry", "stock_threshold", "catalog_attributes")


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def _downgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.downgrade(config, revision)


def _seed(engine: Engine) -> None:
    """Two businesses, each with a variety carrying a row in every table that
    references `variety`."""
    with engine.begin() as connection:
        for business_id in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name) VALUES (:id, :name)"),
                {"id": business_id, "name": f"Negocio {business_id}"},
            )
            connection.execute(
                text(
                    "INSERT INTO variety (id, business_id, name, name_key) "
                    "VALUES (:id, :business_id, :name, :name)"
                ),
                {"id": business_id, "business_id": business_id, "name": f"gelato {business_id}"},
            )
            connection.execute(
                text(
                    "INSERT INTO price_entry (id, business_id, variety_id, effective_from, "
                    "list_price) VALUES (:id, :b, :id, '2026-01-01', 10000)"
                ),
                {"id": business_id, "b": business_id},
            )
            connection.execute(
                text(
                    "INSERT INTO sale (id, business_id, sale_date, shipping_charged, "
                    "recorded_at) VALUES (:id, :b, '2026-01-02', 0, :now)"
                ),
                {"id": business_id, "b": business_id, "now": NOW},
            )
            connection.execute(
                text(
                    "INSERT INTO sale_line (id, business_id, sale_id, variety_id, "
                    "grams_hundredths, pricing_rule, price_per_gram, line_total, position) "
                    "VALUES (:id, :b, :id, :id, 500, 'list', 10000, 50000, 0)"
                ),
                {"id": business_id, "b": business_id},
            )
            connection.execute(
                text(
                    "INSERT INTO stock_entry (id, business_id, entry_date, variety_id, "
                    "origin, grams_hundredths, recorded_at) "
                    "VALUES (:id, :b, '2026-01-01', :id, 'opening_stock', 10000, :now)"
                ),
                {"id": business_id, "b": business_id, "now": NOW},
            )
            connection.execute(
                text(
                    "INSERT INTO stock_threshold (id, business_id, variety_id, "
                    "threshold_hundredths) VALUES (:id, :b, :id, 500)"
                ),
                {"id": business_id, "b": business_id},
            )
            connection.execute(
                text(
                    "INSERT INTO catalog_attributes (id, business_id, variety_id, shown) "
                    "VALUES (:id, :b, :id, 1)"
                ),
                {"id": business_id, "b": business_id},
            )


def _counts(engine: Engine) -> dict[str, int]:
    with engine.connect() as connection:
        return {
            table: connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            for table in ("variety", *REFERENCING)
        }


def _assert_no_broken_references(engine: Engine) -> None:
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        assert dbapi_connection.execute("PRAGMA foreign_key_check").fetchall() == []


def _variety_columns(engine: Engine) -> list[str]:
    return [column["name"] for column in inspect(engine).get_columns("variety")]


def _walk(engine: Engine) -> None:
    _upgrade_to(engine, "0012")
    _seed(engine)
    before = _counts(engine)
    assert all(count == 2 for count in before.values())
    assert "archived_at" not in _variety_columns(engine)

    upgrade_to_head(engine)

    assert _counts(engine) == before
    assert "archived_at" in _variety_columns(engine)
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT COUNT(*) FROM variety WHERE archived_at IS NOT NULL")
            ).scalar_one()
            == 0
        )

    # Step back to 0013 first, so the refusal below is 0013's own and no later
    # migration's downgrade runs ahead of it.
    _downgrade_to(engine, "0013")
    with engine.begin() as connection:
        connection.execute(text("UPDATE variety SET archived_at = :now WHERE id = 1"), {"now": NOW})
    with pytest.raises(RuntimeError) as refused:
        _downgrade_to(engine, "0012")
    assert "archived" in str(refused.value)
    assert "gelato" not in str(refused.value)
    assert "archived_at" in _variety_columns(engine)

    with engine.begin() as connection:
        connection.execute(text("UPDATE variety SET archived_at = NULL"))
    _downgrade_to(engine, "0012")

    assert _counts(engine) == before
    assert "archived_at" not in _variety_columns(engine)
    _assert_no_broken_references(engine)

    upgrade_to_head(engine)
    assert _counts(engine) == before
    assert "archived_at" in _variety_columns(engine)
    _assert_no_broken_references(engine)


def test_upgrade_downgrade_and_upgrade_again_on_plain_sqlite(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_upgrade_downgrade_and_upgrade_again_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()
