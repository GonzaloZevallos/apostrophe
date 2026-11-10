"""`ApplyDecimals` over stored values (docs/adr/0058, the rescale ADR).

Seam: the `ApplyDecimals` use case with the real adapter, over a file-backed SQLite
database seeded through the app's own routes at scale 0. The columns that are rescaled are
the ones tagged `info["money"]` in `app.tables.metadata`, read here the same way, so a
column added later is covered without touching this file.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Table, event, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.money_format.adapters.sql_money_format_writer import SqlMoneyFormatWriter
from app.money_format.application.apply_decimals import ApplyDecimals
from app.money_format.domain.rescale import (
    AmountTooLargeToRescale,
    DecimalsBelowRecordedAmounts,
)
from app.tables import metadata
from tests.business_removal.adapters.seed import PINNED, build_app, seed
from tests.conftest import MovableClock
from tests.statement_log import captured_statements

Dump = dict[str, list[dict[str, Any]]]
World = tuple[Engine, int, int]


def money_columns() -> list[tuple[Table, str, bool]]:
    """Every column tagged `info["money"]`: its table, its name, whether it may be NULL."""
    return [
        (table, column.name, column.nullable)
        for table in metadata.sorted_tables
        for column in table.columns
        if column.info.get("money") is True
    ]


def dump(engine: Engine, business_id: int) -> Dump:
    """Every row of the business, in every table that has a business_id, by id."""
    found: Dump = {}
    with engine.connect() as connection:
        for table in metadata.sorted_tables:
            if "business_id" not in table.c:
                continue
            rows = connection.execute(
                select(table).where(table.c.business_id == business_id).order_by(table.c.id)
            )
            found[table.name] = [dict(row._mapping) for row in rows]
    return found


def _top_up(client: TestClient) -> None:
    """What the seed misses: a price with a bulk and a VIP price, and a stock entry with no
    cost, so every tagged column holds a value somewhere and every nullable one holds NULL."""
    switches = client.put(
        "/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True}
    )
    assert switches.status_code == 200, switches.text
    product = client.post("/api/products", json={"name": "Rosa"})
    assert product.status_code == 201, product.text
    price = client.post(
        f"/api/products/{product.json()['id']}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 4000,
            "bulk_price": 3500,
            "bulk_minimum": 10,
            "vip_price": 3000,
        },
    )
    assert price.status_code == 201, price.text
    entry = client.post(
        "/stock/entries",
        json={"product_id": product.json()["id"], "origin": "adjustment", "quantity": 5},
    )
    assert entry.status_code == 201, entry.text


@pytest.fixture
def world(tmp_path: Path) -> Iterator[World]:
    """A scale-0 database with two businesses; answers the engine, the id of the business
    to rescale (the one `seed` opens last) and the id of the other."""
    db_path = tmp_path / "rescale.db"
    clock = MovableClock(PINNED)
    # `seed` answers the business it opened last (the leaving one) first.
    token_target, token_other = seed(db_path, clock)
    application, engine = build_app(db_path, clock, 0)
    with TestClient(application) as client:
        for token in (token_target, token_other):
            client.headers["Authorization"] = f"Bearer {token}"
            _top_up(client)
    with engine.connect() as connection:
        ids = list(connection.execute(text("SELECT business_id FROM money_format ORDER BY id")))
    yield engine, ids[1][0], ids[0][0]
    engine.dispose()


def apply(engine: Engine, business_id: int, decimals: int) -> None:
    with Session(engine) as session:
        ApplyDecimals(SqlMoneyFormatWriter(session), session).execute(business_id, decimals)


def money_format_of(engine: Engine, business_id: int) -> tuple[int, int]:
    """The business's stored `(scale, decimals)`, read on a fresh connection."""
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT scale, decimals FROM money_format WHERE business_id = :b"),
            {"b": business_id},
        ).one()
    return int(row[0]), int(row[1])


def run(engine: Engine, statement: str) -> None:
    with Session(engine) as session, session.begin():
        session.execute(text(statement))


@contextmanager
def updates(engine: Engine) -> Iterator[list[tuple[str, int]]]:
    """The `(statement, rows changed)` of every UPDATE the engine runs inside the block."""
    seen: list[tuple[str, int]] = []

    def _after(conn: Any, cursor: Any, statement: str, *args: object) -> None:
        if statement.lstrip().upper().startswith("UPDATE"):
            seen.append((statement, cursor.rowcount))

    event.listen(engine, "after_cursor_execute", _after)
    try:
        yield seen
    finally:
        event.remove(engine, "after_cursor_execute", _after)


def test_the_seed_reaches_every_tagged_column_and_every_nullable_one(world: World) -> None:
    engine, target, _ = world
    columns = money_columns()
    assert len(columns) >= 9
    with Session(engine) as session:
        for table, name, nullable in columns:
            column = table.c[name]
            non_zero = session.scalar(
                select(func.count(column)).where(table.c.business_id == target, column != 0)
            )
            assert non_zero, f"{table.name}.{name} holds no non-zero value for the business"
            if nullable:
                nulls = session.scalar(
                    select(func.count()).where(table.c.business_id == target, column.is_(None))
                )
                assert nulls, f"{table.name}.{name} holds no NULL for the business"


def test_the_rescale_multiplies_every_tagged_column_by_100_and_leaves_the_rest(
    world: World,
) -> None:
    engine, target, other = world
    before, other_before = dump(engine, target), dump(engine, other)
    assert money_format_of(engine, target) == (0, 0)

    apply(engine, target, 2)

    after = dump(engine, target)
    tagged = {(table.name, name) for table, name, _ in money_columns()}
    for name, rows in before.items():
        assert len(after[name]) == len(rows), name
        if name == "money_format":
            continue
        for old, new in zip(rows, after[name], strict=True):
            for key, value in old.items():
                expected = value * 100 if (name, key) in tagged and value is not None else value
                assert new[key] == expected, f"{name}.{key}"
    assert dump(engine, other) == other_before
    # Committed, and visible on a fresh connection: the guard did not roll it back.
    assert money_format_of(engine, target) == (2, 2)
    assert money_format_of(engine, other) == (0, 0)


def test_an_amount_too_large_to_rescale_rolls_everything_back(world: World) -> None:
    engine, target, other = world
    run(engine, f"UPDATE expense SET amount = {2**62} WHERE business_id = {target}")
    before, other_before = dump(engine, target), dump(engine, other)

    with pytest.raises(AmountTooLargeToRescale) as raised:
        apply(engine, target, 2)

    assert str(raised.value) == "an amount is too large to be rescaled: nothing changed"
    assert dump(engine, target) == before
    assert dump(engine, other) == other_before
    assert money_format_of(engine, target) == (0, 0)


def test_after_the_rescale_only_a_different_decimals_is_written(world: World) -> None:
    engine, target, other = world
    apply(engine, target, 2)
    amounts = {name: rows for name, rows in dump(engine, target).items() if name != "money_format"}

    for decimals, writes in ((2, 0), (1, 1), (1, 0), (2, 1), (0, 1), (0, 0), (2, 1)):
        with updates(engine) as seen:
            apply(engine, target, decimals)
        changed = sum(rows for _, rows in seen)
        assert changed == writes, (decimals, seen)
        assert money_format_of(engine, target) == (2, decimals)
        for statement, rows in seen:
            if rows:
                assert statement.lstrip().upper().startswith("UPDATE MONEY_FORMAT SET DECIMALS")
    assert {n: r for n, r in dump(engine, target).items() if n != "money_format"} == amounts
    assert money_format_of(engine, other) == (0, 0)


def test_lowering_at_scale_0_to_0_writes_nothing(world: World) -> None:
    engine, target, _ = world
    with updates(engine) as seen:
        apply(engine, target, 0)
    assert sum(rows for _, rows in seen) == 0
    assert money_format_of(engine, target) == (0, 0)


def test_a_lower_below_the_recorded_amounts_is_refused_and_stores_nothing(world: World) -> None:
    engine, target, _ = world
    apply(engine, target, 2)
    run(engine, f"UPDATE expense SET amount = 150050 WHERE business_id = {target}")
    before = dump(engine, target)

    with pytest.raises(DecimalsBelowRecordedAmounts) as raised:
        apply(engine, target, 0)

    assert str(raised.value) == "an amount recorded holds more decimals than the new ones"
    assert dump(engine, target) == before
    assert money_format_of(engine, target) == (2, 2)
    # By the remainder, not by a flag: tenths still hold 1500.50 but not 1500.55.
    apply(engine, target, 1)
    run(engine, f"UPDATE money_format SET decimals = 2 WHERE business_id = {target}")
    run(engine, f"UPDATE expense SET amount = 150055 WHERE business_id = {target}")
    with pytest.raises(DecimalsBelowRecordedAmounts):
        apply(engine, target, 1)
    assert money_format_of(engine, target) == (2, 2)


def test_a_lower_within_the_recorded_amounts_is_written(world: World) -> None:
    engine, target, _ = world
    apply(engine, target, 2)
    run(engine, f"UPDATE expense SET amount = 150050 WHERE business_id = {target}")

    apply(engine, target, 1)

    assert money_format_of(engine, target) == (2, 1)


def test_the_rescale_issues_the_conditional_update_and_one_multiply_per_tagged_column(
    world: World,
) -> None:
    engine, target, _ = world
    with captured_statements(engine) as statements:
        apply(engine, target, 2)

    updated = [s for s, _ in statements if s.lstrip().upper().startswith("UPDATE")]
    assert updated[0].startswith("UPDATE money_format SET scale")
    multiplied = [s for s in updated if "*" in s]
    assert len(multiplied) == len(money_columns())
