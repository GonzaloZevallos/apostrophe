"""Migration 0021 gives every existing business the two default withdrawal reasons, once,
through the real revisions from 0019, and changes nothing that existed (the shared
comparator). The seeded names and keys are literals; they equal `name_key` and the
defaults port's English."""

from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog
from app.shared.language import ENGLISH
from app.shared.names import name_key
from app.stock.adapters.babel_defaults import BabelReasonDefaults
from tests.migrations.comparator import Snapshot, compare, snapshot, upgrade_and_compare, upgrade_to

NOW = "2026-01-01 12:00:00"
DEFAULTS = [("Marketing", "marketing", 0), ("Own use", "own use", 1)]


def _engine_at_0019(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to(engine, "0019")
    with engine.begin() as connection:
        for business_id in (1, 2, 3):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :n, 'en')"),
                {"b": business_id, "n": f"Negocio {business_id}"},
            )
        for business_id in (1, 2):
            connection.execute(
                text(
                    "INSERT INTO stock_withdrawal "
                    "(id, business_id, reason, withdrawn_on, recorded_at) "
                    "VALUES (:b, :b, 'promotion', '2026-01-01', :now)"
                ),
                {"b": business_id, "now": NOW},
            )
    return engine


def _reasons(after: Snapshot) -> dict[int, list[tuple[str, str, int]]]:
    found: dict[int, list[tuple[str, str, int]]] = {}
    for row in after["withdrawal_reason"].values():
        found.setdefault(row["business_id"], []).append(
            (row["name"], row["name_key"], row["position"])
        )
    return {business: sorted(rows, key=lambda r: r[2]) for business, rows in found.items()}


def test_every_business_gets_the_two_defaults_and_nothing_that_existed_changes(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0019(tmp_path)

    after = upgrade_and_compare(engine, "0021")

    # business 3 has no withdrawals at all and is seeded all the same
    assert _reasons(after) == {1: DEFAULTS, 2: DEFAULTS, 3: DEFAULTS}
    engine.dispose()


def test_the_comparator_would_catch_a_migration_that_rewrote_a_withdrawal(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0019(tmp_path)
    before = snapshot(engine)
    upgrade_to(engine, "0021")
    with engine.begin() as connection:
        connection.execute(text("UPDATE stock_withdrawal SET reason = 'own_use' WHERE id = 1"))

    with pytest.raises(AssertionError, match="column 'reason' was 'promotion'"):
        compare(before, snapshot(engine))
    engine.dispose()


def test_each_literal_pair_is_the_shared_name_key_of_its_name() -> None:
    for name, key, _position in DEFAULTS:
        assert key == name_key(name)


def test_the_literals_are_the_defaults_ports_english() -> None:
    names = BabelReasonDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(ENGLISH)

    assert [(name.value, name.key) for name in names] == [(n, k) for n, k, _ in DEFAULTS]


def test_the_table_keeps_a_name_once_per_business(tmp_path: Path) -> None:
    engine = _engine_at_0019(tmp_path)
    upgrade_to(engine, "0021")

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO withdrawal_reason (business_id, name, name_key, position) "
                "VALUES (1, 'MARKETING', 'marketing', 5)"
            )
        )
    engine.dispose()
