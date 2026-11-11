"""What the rescale tests share: a scale-0 database with two businesses seeded through the
app's own routes, and the readers that compare it before and after (docs/adr/0058). The
columns that are rescaled are the ones tagged `info["money"]` in `app.tables.metadata`,
read here the same way, so a column added later is covered without touching a test."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any, NamedTuple

from fastapi.testclient import TestClient
from sqlalchemy import Table, event, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.money_format.adapters.sql_money_format_writer import SqlMoneyFormatWriter
from app.money_format.application.apply_decimals import ApplyDecimals
from app.tables import metadata
from tests.business_removal.adapters.seed import PINNED, build_app, seed
from tests.conftest import MovableClock

Dump = dict[str, list[dict[str, Any]]]


class World(NamedTuple):
    """The engine, the id of the business to rescale, the id of the other one, the session
    token of the first and the database file."""

    engine: Engine
    target: int
    other: int
    token: str
    path: Path


def money_columns() -> list[tuple[Table, str, bool]]:
    """Every column tagged `info["money"]`: its table, its name, whether it may be NULL."""
    return [
        (table, column.name, bool(column.nullable))
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


def _give_vip_type(engine: Engine, business_id: int) -> None:
    """The VIP type the upgrade or the import makes (docs/adr/0070), set on the row: without
    it the VIP price of a Price entry has nowhere to be kept and is dropped (docs/adr/0059)."""
    with Session(engine) as session:
        session.add(
            CustomerTypeRow(
                business_id=business_id,
                name="VIP",
                name_key="vip",
                icon="star",
                is_vip=True,
            )
        )
        session.commit()


def _freeze_legacy_vip_price(engine: Engine, business_id: int) -> None:
    """The frozen `price_entry.vip_price` is never written by the app any more, so a value
    in it is what an earlier version left: set on the rows, so the rescale is still seen to
    multiply it."""
    run(
        engine,
        f"UPDATE price_entry SET vip_price = 3000 WHERE business_id = {business_id}"
        " AND vip_price IS NULL AND bulk_price IS NOT NULL",
    )


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


def build_world(tmp_path: Path) -> Iterator[World]:
    """A scale-0 database with two businesses; answers the engine, the id of the business
    to rescale (the one `seed` opens last) and the id of the other."""
    db_path = tmp_path / "rescale.db"
    clock = MovableClock(PINNED)
    # `seed` answers the business it opened last (the leaving one) first.
    token_target, token_other = seed(db_path, clock)
    application, engine = build_app(db_path, clock, 0)
    with engine.connect() as connection:
        ids = list(connection.execute(text("SELECT business_id FROM money_format ORDER BY id")))
    for (business_id,) in ids:
        _give_vip_type(engine, business_id)
    with TestClient(application) as client:
        for token in (token_target, token_other):
            client.headers["Authorization"] = f"Bearer {token}"
            _top_up(client)
    for (business_id,) in ids:
        _freeze_legacy_vip_price(engine, business_id)
    yield World(engine, ids[1][0], ids[0][0], token_target, db_path)
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
