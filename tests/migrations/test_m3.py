"""The comparator proves itself on inputs it must reject, as well as on the one it passes."""

from collections.abc import Callable, Iterator

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db import make_engine
from app.migrations.runner import upgrade_to
from tests.migrations import m3_seed
from tests.migrations.m3 import (
    TableSnapshot,
    assert_m3,
    assert_unchanged,
    snapshot_tables,
)


@pytest.fixture
def seeded() -> Iterator[Connection]:
    engine = make_engine("sqlite://")
    upgrade_to(engine, "0019")
    with engine.begin() as connection:
        m3_seed.SEED_INCREMENTS["0019"](connection)
        yield connection


def _before_and_after(
    connection: Connection, change: str
) -> tuple[dict[str, TableSnapshot], dict[str, TableSnapshot]]:
    before = snapshot_tables(connection)
    connection.execute(text(change))
    return before, snapshot_tables(connection)


def test_the_no_op_upgrade_changes_nothing_and_creates_nothing() -> None:
    assert assert_m3("0019", "0019") == frozenset()


def test_the_snapshot_holds_every_table_but_the_bookkeeping_one(seeded: Connection) -> None:
    tables = snapshot_tables(seeded)

    assert "alembic_version" not in tables
    assert {"business", "login_guard", "login_address_guard", "sale_line"} <= set(tables)
    assert [row[0] for row in tables["business"].rows] == [1, 2]


def test_an_updated_value_fails_naming_the_table(seeded: Connection) -> None:
    before, after = _before_and_after(seeded, "UPDATE expense SET amount = amount + 1")

    with pytest.raises(AssertionError, match="table expense: the rows changed"):
        assert_unchanged(before, after)


def test_a_changed_ddl_fails_naming_the_table(seeded: Connection) -> None:
    before, after = _before_and_after(seeded, "ALTER TABLE sale ADD COLUMN extra INTEGER")

    with pytest.raises(AssertionError, match="table sale: the DDL changed"):
        assert_unchanged(before, after)


def test_a_missing_table_fails_naming_the_table(seeded: Connection) -> None:
    before, after = _before_and_after(seeded, "DROP TABLE login_guard")

    with pytest.raises(AssertionError, match="table login_guard is missing"):
        assert_unchanged(before, after)


def test_a_new_table_is_returned_and_an_identical_table_passes(seeded: Connection) -> None:
    before, after = _before_and_after(seeded, "CREATE TABLE money_format (id INTEGER)")

    assert assert_unchanged(before, before) == frozenset()
    assert assert_unchanged(before, after) == frozenset({"money_format"})


def test_a_table_left_empty_by_the_seed_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    seed: Callable[[Connection], None] = m3_seed.SEED_INCREMENTS["0019"]

    def seed_then_empty_a_table(connection: Connection) -> None:
        seed(connection)
        connection.execute(text("DELETE FROM login_guard"))

    monkeypatch.setitem(m3_seed.SEED_INCREMENTS, "0019", seed_then_empty_a_table)

    with pytest.raises(AssertionError, match=r"empty at 0019: \['login_guard'\]"):
        assert_m3("0019", "0019")
