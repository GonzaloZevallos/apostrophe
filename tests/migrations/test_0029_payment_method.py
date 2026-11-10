"""Migration 0029 gives every existing business the two default payment methods, once,
through the real revisions from 0019, and changes nothing that existed (the shared
comparator). The seeded names and keys are literals; they equal what the domain derives."""

from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.payment_methods.domain.method import PaymentMethodName
from tests.migrations.comparator import compare, snapshot, upgrade_and_compare, upgrade_to

DEFAULTS = [("Cash", "cash", "banknote", 1), ("Transfer", "transfer", "bank", 2)]


def _engine_at_0028(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to(engine, "0028")
    with engine.begin() as connection:
        for business_id in (1, 2, 3):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :n, 'en')"),
                {"b": business_id, "n": f"Negocio {business_id}"},
            )
    return engine


def test_every_business_gets_the_two_defaults_and_nothing_that_existed_changes(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0028(tmp_path)

    after = upgrade_and_compare(engine, "0029")

    found: dict[int, list[tuple[str, str, str, int]]] = {}
    for row in after["payment_method"].values():
        assert row["archived_at"] is None
        found.setdefault(row["business_id"], []).append(
            (row["name"], row["name_key"], row["icon"], row["position"])
        )
    assert found == {1: DEFAULTS, 2: DEFAULTS, 3: DEFAULTS}
    engine.dispose()


def test_the_comparator_would_catch_a_migration_that_rewrote_a_business(tmp_path: Path) -> None:
    engine = _engine_at_0028(tmp_path)
    before = snapshot(engine)
    upgrade_to(engine, "0029")
    with engine.begin() as connection:
        connection.execute(text("UPDATE business SET name = 'Rewritten' WHERE id = 1"))

    with pytest.raises(AssertionError, match="name"):
        compare(before, snapshot(engine))
    engine.dispose()


def test_each_literal_key_is_what_the_domain_derives_from_its_name() -> None:
    for name, key, _icon, _position in DEFAULTS:
        assert key == PaymentMethodName.of(name).name_key


def test_the_table_keeps_a_name_once_per_business(tmp_path: Path) -> None:
    engine = _engine_at_0028(tmp_path)
    upgrade_to(engine, "0029")

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO payment_method (business_id, name, name_key, icon, position) "
                "VALUES (1, 'CASH', 'cash', 'other', 5)"
            )
        )
    engine.dispose()
