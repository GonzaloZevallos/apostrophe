"""Migration 0023 gives every sale its per-business number (CONTEXT.md: Sale number) and
every business its counter, through the real revisions from 0022, over the plain sqlite
driver and sqlite+libsql (ADR-0016): numbers follow `(sale_date, recorded_at, id)` inside
each business, each counter is that business's highest number (0 with no sales), nothing
else changes, `(business_id, number)` is unique, and the walk down and up again is whole."""

from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head
from tests.migrations.comparator import upgrade_to

EARLY = "2026-03-01 08:00:00"
MIDDLE = "2026-03-01 12:00:00"
LATE = "2026-03-02 12:00:00"

# (id, business_id, sale_date, recorded_at, paid on the spot). The ids interleave the two
# businesses; sales 1 and 4 tie on date and instant, so the id decides; sale 3 is backdated
# and recorded later; sale 5 shares sale 2's date and was recorded before it.
SALES = (
    (1, 1, "2026-03-10", MIDDLE, True),
    (2, 2, "2026-03-05", MIDDLE, False),
    (3, 1, "2026-03-01", LATE, False),
    (4, 1, "2026-03-10", MIDDLE, True),
    (5, 2, "2026-03-05", EARLY, True),
    (6, 2, "2026-03-20", MIDDLE, False),
    (7, 1, "2026-03-12", EARLY, False),
)
NUMBERS = {3: 1, 1: 2, 4: 3, 7: 4, 5: 1, 2: 2, 6: 3}
COUNTERS = {1: 4, 2: 3, 3: 0}
TABLES = ("sale", "sale_line", "payment")


def _migrate_down(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        raw = connection.connection.dbapi_connection
        assert raw is not None
        # As the upgrade runner does: a rebuild of a referenced table needs foreign keys
        # off before any write.
        raw.execute("PRAGMA foreign_keys=OFF")
        with connection.begin():
            command.downgrade(config, revision)
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
        raw.execute("PRAGMA foreign_keys=ON")


def _seed(engine: Engine) -> None:
    """Three businesses (the third with no sale), every sale with two lines, the paying
    ones with an on-the-spot payment."""
    with engine.begin() as connection:
        for business in (1, 2, 3):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :name, 'en')"),
                {"b": business, "name": f"Negocio {business}"},
            )
        for business in (1, 2):
            connection.execute(
                text(
                    "INSERT INTO variety (id, business_id, name, name_key) "
                    "VALUES (:b, :b, :name, :name)"
                ),
                {"b": business, "name": f"gelato {business}"},
            )
        for sale_id, business, day, recorded_at, paid in SALES:
            connection.execute(
                text(
                    "INSERT INTO sale (id, business_id, sale_date, shipping_charged, "
                    "recorded_at) VALUES (:id, :b, :day, 0, :at)"
                ),
                {"id": sale_id, "b": business, "day": day, "at": recorded_at},
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
            if paid:
                connection.execute(
                    text(
                        "INSERT INTO payment (id, business_id, paid_on, amount, method, "
                        "customer_id, sale_id, recorded_at) VALUES (:id, :b, :day, 1000, "
                        "'cash', NULL, :sale, :at)"
                    ),
                    {"id": sale_id, "b": business, "day": day, "sale": sale_id, "at": recorded_at},
                )


def _counts(engine: Engine) -> dict[str, int]:
    with engine.connect() as connection:
        return {
            table: int(connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one())
            for table in TABLES
        }


def _numbers(engine: Engine) -> dict[int, int]:
    with engine.connect() as connection:
        return {
            int(sale_id): int(number)
            for sale_id, number in connection.execute(text("SELECT id, number FROM sale"))
        }


def _counters(engine: Engine) -> dict[int, int]:
    with engine.connect() as connection:
        return {
            int(business): int(counter)
            for business, counter in connection.execute(
                text("SELECT id, last_sale_number FROM business")
            )
        }


def _unchanged_columns(engine: Engine) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        return [
            tuple(row)
            for row in connection.execute(
                text(
                    "SELECT id, business_id, sale_date, customer_id, shipping_charged, note, "
                    "recorded_at FROM sale ORDER BY id"
                )
            )
        ]


def _assert_numbered(engine: Engine) -> None:
    assert _numbers(engine) == NUMBERS
    assert _counters(engine) == COUNTERS
    columns = {column["name"]: column for column in inspect(engine).get_columns("sale")}
    assert columns["number"]["nullable"] is False
    assert columns["number"]["default"] is None
    counter = {column["name"]: column for column in inspect(engine).get_columns("business")}
    assert counter["last_sale_number"]["nullable"] is False
    assert str(counter["last_sale_number"]["default"]).strip("'\"") == "0"
    assert {"name": "uq_sale_business_id_number", "column_names": ["business_id", "number"]} in (
        inspect(engine).get_unique_constraints("sale")
    )


def _walk(engine: Engine) -> None:
    upgrade_to(engine, "0022")
    _seed(engine)
    counts = _counts(engine)
    columns = _unchanged_columns(engine)
    assert counts == {"sale": 7, "sale_line": 14, "payment": 3}

    upgrade_to_head(engine)

    with engine.connect() as connection:
        raw = connection.connection.dbapi_connection
        assert raw is not None
        assert raw.execute("PRAGMA foreign_key_check").fetchall() == []
    assert _counts(engine) == counts
    assert _unchanged_columns(engine) == columns
    _assert_numbered(engine)

    _migrate_down(engine, "0022")
    assert _counts(engine) == counts
    assert _unchanged_columns(engine) == columns
    assert "number" not in {column["name"] for column in inspect(engine).get_columns("sale")}
    assert "last_sale_number" not in {
        column["name"] for column in inspect(engine).get_columns("business")
    }
    assert inspect(engine).get_unique_constraints("sale") == []

    upgrade_to_head(engine)
    assert _counts(engine) == counts
    _assert_numbered(engine)


def test_numbers_follow_date_then_recording_then_id_per_business_on_plain_sqlite(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_numbers_follow_date_then_recording_then_id_per_business_on_libsql(tmp_path: Path) -> None:
    pytest.importorskip("sqlalchemy_libsql")
    engine = make_engine(f"sqlite+libsql:///{tmp_path / 'apostrophe.db'}")
    _walk(engine)
    engine.dispose()


def test_a_duplicate_number_in_one_business_is_refused_but_another_business_may_repeat_it(
    tmp_path: Path,
) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    insert = text(
        "INSERT INTO sale (business_id, sale_date, shipping_charged, recorded_at, number) "
        "VALUES (:b, '2026-03-01', 0, :at, :n)"
    )
    with engine.begin() as connection:
        for business in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, 'N', 'en')"),
                {"b": business},
            )
        connection.execute(insert, {"b": 1, "at": MIDDLE, "n": 1})
        connection.execute(insert, {"b": 2, "at": MIDDLE, "n": 1})

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(insert, {"b": 1, "at": LATE, "n": 1})
    engine.dispose()


def test_a_sale_without_a_number_is_refused_at_head(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (1, 'N', 'en')"))
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO sale (business_id, sale_date, shipping_charged, recorded_at) "
                "VALUES (1, '2026-03-01', 0, :at)"
            ),
            {"at": MIDDLE},
        )
    engine.dispose()
