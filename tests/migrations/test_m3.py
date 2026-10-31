"""The shared M3 comparator rejects what a migration must never do and accepts what it may
(plan invariant): a changed, vanished or retyped value fails it; an added table, column or
row does not."""

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import make_engine
from tests.migrations.m3 import assert_no_value_changed, changed_values, snapshot


@pytest.fixture
def engine() -> Engine:
    engine = make_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE thing (id INTEGER PRIMARY KEY, name TEXT)"))
        connection.execute(text("CREATE TABLE note (body TEXT, mark TEXT)"))
        connection.execute(text("INSERT INTO thing VALUES (1, 'uno'), (2, 'dos')"))
        connection.execute(text("INSERT INTO note VALUES ('a', 'x'), ('b', 'y')"))
    return engine


def _run(engine: Engine, *statements: str) -> None:
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def test_a_migration_that_only_adds_passes(engine: Engine) -> None:
    before = snapshot(engine)

    _run(
        engine,
        "ALTER TABLE thing ADD COLUMN zone TEXT DEFAULT 'x'",
        "INSERT INTO thing (id, name, zone) VALUES (3, 'tres', 'y')",
        "CREATE TABLE fresh (id INTEGER PRIMARY KEY)",
    )

    assert changed_values(before, snapshot(engine)) == []
    assert_no_value_changed(before, snapshot(engine))


def test_a_changed_value_fails_naming_the_column(engine: Engine) -> None:
    before = snapshot(engine)

    _run(engine, "UPDATE thing SET name = 'DOS' WHERE id = 2")

    with pytest.raises(AssertionError, match=r"thing\.name: 'dos' is no longer there"):
        assert_no_value_changed(before, snapshot(engine))


def test_a_vanished_row_fails_naming_the_table(engine: Engine) -> None:
    before = snapshot(engine)

    _run(engine, "DELETE FROM thing WHERE id = 1")

    assert changed_values(before, snapshot(engine)) == ["thing: the row (1,) is gone"]


def test_a_dropped_column_fails(engine: Engine) -> None:
    before = snapshot(engine)

    _run(engine, "ALTER TABLE thing DROP COLUMN name")

    assert "thing.name: 'uno' is no longer there" in changed_values(before, snapshot(engine))


def test_a_dropped_table_fails(engine: Engine) -> None:
    before = snapshot(engine)

    _run(engine, "DROP TABLE thing")

    assert changed_values(before, snapshot(engine)) == ["thing: the table is gone"]


def test_a_changed_value_in_a_table_without_a_primary_key_fails(engine: Engine) -> None:
    before = snapshot(engine)

    _run(engine, "UPDATE note SET mark = 'z' WHERE body = 'a'")

    problems = changed_values(before, snapshot(engine))
    assert len(problems) == 1
    assert problems[0].startswith("note:")
