"""Migration 0021 links every stock withdrawal to its reason by the `name_key` migration
0020 wrote, through the real revisions, and changes no value that existed (the shared
comparator). The legacy `reason` column keeps every value; only its nullability moves."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT
from tests.migrations.comparator import Snapshot, compare, snapshot, upgrade_to

NOW = "2026-01-01 12:00:00"


def _upgrade_as_the_runner_does(engine: Engine, revision: str) -> None:
    """Rebuilding `stock_withdrawal` drops a table `stock_withdrawal_line` points at, so
    this runs with foreign keys off and checks them at the end, as `upgrade_to_head`
    does; the shared `upgrade_to` leaves them on."""
    with engine.connect() as connection:
        raw = connection.connection.dbapi_connection
        assert raw is not None
        raw.execute("PRAGMA foreign_keys=OFF")
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)
        assert raw.execute("PRAGMA foreign_key_check").fetchone() is None
        raw.execute("PRAGMA foreign_keys=ON")


def _engine_at_0020(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to(engine, "0020")
    with engine.begin() as connection:
        for business_id in (1, 2, 3):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :n, 'en')"),
                {"b": business_id, "n": f"Negocio {business_id}"},
            )
    return engine


def _seed_reasons(engine: Engine) -> None:
    """Revision 0020 ran before the businesses existed, so seed what it would have."""
    with engine.begin() as connection:
        for business_id in (1, 2):
            for name, key, position in (("Marketing", "marketing", 0), ("Own use", "own use", 1)):
                connection.execute(
                    text(
                        "INSERT INTO withdrawal_reason (business_id, name, name_key, position) "
                        "VALUES (:b, :n, :k, :p)"
                    ),
                    {"b": business_id, "n": name, "k": key, "p": position},
                )


def _withdraw(engine: Engine, withdrawal_id: int, business_id: int, reason: str) -> None:
    """A withdrawal with two lines of one variety of its business, so the rebuild of
    `stock_withdrawal` is compared with `stock_withdrawal_line` rows pointing at it."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT OR IGNORE INTO variety (id, business_id, name, name_key) "
                "VALUES (:b, :b, 'Variedad', :k)"
            ),
            {"b": business_id, "k": f"variedad {business_id}"},
        )
        connection.execute(
            text(
                "INSERT INTO stock_withdrawal (id, business_id, reason, withdrawn_on, recorded_at)"
                " VALUES (:i, :b, :r, '2026-01-01', :now)"
            ),
            {"i": withdrawal_id, "b": business_id, "r": reason, "now": NOW},
        )
        for position in (0, 1):
            connection.execute(
                text(
                    "INSERT INTO stock_withdrawal_line "
                    "(id, business_id, stock_withdrawal_id, variety_id, position, "
                    "grams_hundredths) VALUES (:id, :b, :w, :b, :p, :g)"
                ),
                {
                    "id": withdrawal_id * 10 + position,
                    "b": business_id,
                    "w": withdrawal_id,
                    "p": position,
                    "g": 150 + position,
                },
            )


def _linked(after: Snapshot) -> dict[int, tuple[str, int]]:
    """Each withdrawal's reason name and the business of that reason."""
    reasons = {key[0]: row for key, row in after["withdrawal_reason"].items()}
    return {
        key[0]: (
            reasons[row["withdrawal_reason_id"]]["name"],
            reasons[row["withdrawal_reason_id"]]["business_id"],
        )
        for key, row in after["stock_withdrawal"].items()
    }


def test_each_withdrawal_links_to_the_reason_of_its_own_business_and_nothing_changes(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0020(tmp_path)
    _seed_reasons(engine)
    _withdraw(engine, 1, 1, "promotion")
    _withdraw(engine, 2, 1, "own_use")
    _withdraw(engine, 3, 2, "promotion")
    before = snapshot(engine)

    _upgrade_as_the_runner_does(engine, "0021")
    after = snapshot(engine)

    compare(before, after)
    # The lines survive the rebuild of their parent: same count, ids and every value.
    assert len(before["stock_withdrawal_line"]) == 6
    assert after["stock_withdrawal_line"] == before["stock_withdrawal_line"]
    assert _linked(after) == {1: ("Marketing", 1), 2: ("Own use", 1), 3: ("Marketing", 2)}
    assert {row["reason"] for row in after["stock_withdrawal"].values()} == {
        "promotion",
        "own_use",
    }
    engine.dispose()


def test_a_business_missing_a_seeded_key_gets_it_inserted_at_the_end_never_failing(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0020(tmp_path)
    with engine.begin() as connection:
        # Business 3 opened in another language after 0020: neither seeded key, one reason.
        connection.execute(
            text(
                "INSERT INTO withdrawal_reason (business_id, name, name_key, position) "
                "VALUES (3, 'Mercadeo', 'mercadeo', 4)"
            )
        )
    _withdraw(engine, 1, 3, "promotion")
    _withdraw(engine, 2, 3, "own_use")
    before = snapshot(engine)

    _upgrade_as_the_runner_does(engine, "0021")
    after = snapshot(engine)

    # `withdrawal_reason` is the one table that grows here, so it is read on its own: the
    # comparator guards every table that existed and may not grow.
    reasons_before = before.pop("withdrawal_reason")
    compare(before, {name: rows for name, rows in after.items() if name != "withdrawal_reason"})
    reasons_after = after["withdrawal_reason"]
    for key, row in reasons_before.items():
        assert reasons_after[key] == row
    added = sorted(
        (row["name"], row["name_key"], row["position"])
        for key, row in reasons_after.items()
        if key not in reasons_before
    )
    assert added == [("Marketing", "marketing", 5), ("Own use", "own use", 6)]
    assert _linked(after) == {1: ("Marketing", 3), 2: ("Own use", 3)}
    engine.dispose()


def test_a_business_with_all_its_keys_gets_no_extra_reason(tmp_path: Path) -> None:
    engine = _engine_at_0020(tmp_path)
    _seed_reasons(engine)
    _withdraw(engine, 1, 1, "promotion")

    _upgrade_as_the_runner_does(engine, "0021")

    assert len(snapshot(engine)["withdrawal_reason"]) == 4
    engine.dispose()


def test_the_new_link_is_required_restricted_and_never_crosses_a_business(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0020(tmp_path)
    _seed_reasons(engine)
    _upgrade_as_the_runner_does(engine, "0021")
    insert = (
        "INSERT INTO stock_withdrawal "
        "(business_id, withdrawal_reason_id, reason, withdrawn_on, recorded_at) "
        "VALUES (:b, :r, NULL, '2026-01-01', :now)"
    )
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text(insert), {"b": 1, "r": 1, "now": NOW})
        reason_of_business_2 = connection.execute(
            text("SELECT id FROM withdrawal_reason WHERE business_id = 2 LIMIT 1")
        ).scalar_one()

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text(insert), {"b": 1, "r": reason_of_business_2, "now": NOW})
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text("DELETE FROM withdrawal_reason WHERE id = 1"))
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO stock_withdrawal (business_id, reason, withdrawn_on, recorded_at) "
                "VALUES (1, 'promotion', '2026-01-01', :now)"
            ),
            {"now": NOW},
        )
    checks = inspect(engine).get_check_constraints("stock_withdrawal")
    assert [check["name"] for check in checks] == ["ck_stock_withdrawal_reason"]
    engine.dispose()
