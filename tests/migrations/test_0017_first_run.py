"""Migration 0017 adds the `first_run` table (ADR-0046) and takes it away again without
touching a row of any other table, over a plain sqlite file and a libsql one
(ADR-0016). No backfill: a business that existed before gets no row."""

from pathlib import Path

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from tests.migrations.test_0016_list_indexes import _migrate

COLUMNS = ("id", "business_id", "checklist_gone_at", "imported_at", "import_notice_over_at")


def _walk(engine: Engine) -> None:
    _migrate(engine, "up", "0016")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name) VALUES (1, 'Vieja Huerta')"))
    assert "first_run" not in inspect(engine).get_table_names()

    upgrade_to_head(engine)

    inspector = inspect(engine)
    columns = {c["name"]: c for c in inspector.get_columns("first_run")}
    assert tuple(columns) == COLUMNS
    assert columns["business_id"]["nullable"] is False
    assert [columns[name]["nullable"] for name in COLUMNS[2:]] == [True, True, True]
    assert [
        (u["name"], u["column_names"]) for u in inspector.get_unique_constraints("first_run")
    ] == [("uq_first_run_business_id", ["business_id"])]
    assert [(f["name"], f["referred_table"]) for f in inspector.get_foreign_keys("first_run")] == [
        ("fk_first_run_business_id_business", "business")
    ]
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM first_run")).scalar_one() == 0

    with engine.begin() as connection:
        connection.execute(text("INSERT INTO first_run (business_id) VALUES (1)"))

    _migrate(engine, "down", "0016")

    assert "first_run" not in inspect(engine).get_table_names()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM business")).scalar_one() == "Vieja Huerta"

    upgrade_to_head(engine)
    assert "first_run" in inspect(engine).get_table_names()


def test_upgrade_downgrade_and_upgrade_again_on_plain_sqlite(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_upgrade_downgrade_and_upgrade_again_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()
