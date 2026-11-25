"""Every table that points at `payment_method` is counted in its `in_use`
(docs/adr/20261124-a-payment-method-is-in-use-when-any-payment-or-expense-points-at-it).

The tables are found by reflecting `app.tables.metadata`, so a new table with a foreign key to
`payment_method` fails here until it has a seeder below, and a seeder only counts when it
really makes the method `in_use` and refuses its delete. Every such key is `RESTRICT`, so
the database refuses a delete the use case's check missed.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Column, ForeignKey, Integer, MetaData, Table

from app.tables import metadata

METHODS = "/api/payment-methods"
TARGET = "payment_method"


def referencing_tables(schema: MetaData) -> set[str]:
    """The tables other than `payment_method` with a foreign key to it."""
    return {
        table.name
        for table in schema.tables.values()
        if table.name != TARGET
        and any(key.column.table.name == TARGET for key in table.foreign_keys)
    }


def not_restrict(schema: MetaData) -> list[str]:
    """`table: columns` for every foreign key to `payment_method` not declared RESTRICT."""
    return sorted(
        f"{table.name}: {', '.join(c.name for c in constraint.columns)}"
        for table in schema.tables.values()
        if table.name != TARGET
        for constraint in table.foreign_key_constraints
        if constraint.referred_table.name == TARGET and constraint.ondelete != "RESTRICT"
    )


def unseeded(schema: MetaData, seeders: Mapping[str, object]) -> set[str]:
    """The referencing tables with no seeder, and the seeders for no referencing table."""
    return referencing_tables(schema) ^ set(seeders)


def _payment(client: TestClient, method_id: int) -> None:
    product = client.post("/api/products", json={"name": f"Lavanda {method_id}"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    response = client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": method_id},
            "lines": [{"product_id": product["id"], "quantity": "1"}],
        },
    )
    assert response.status_code == 201, response.text


def _expense(client: TestClient, method_id: int) -> None:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == "Other")
    response = client.post(
        "/expenses",
        json={
            "spent_on": "2026-10-02",
            "category_id": category["id"],
            "amount": 1_000,
            "detail": "fletes",
            "payment_method_id": method_id,
        },
    )
    assert response.status_code == 201, response.text


# A table that points at `payment_method` adds its seeder here in the diff that adds it.
SEEDERS: dict[str, Callable[[TestClient, int], None]] = {
    "payment": _payment,
    "expense": _expense,
}


def _toy(ondelete: str | None, *, referencing: bool = True) -> MetaData:
    schema = MetaData()
    Table(TARGET, schema, Column("id", Integer, primary_key=True))
    Table(
        "booking",
        schema,
        Column("id", Integer, primary_key=True),
        Column(
            "method_id",
            Integer,
            ForeignKey(f"{TARGET}.id" if referencing else "other.id", ondelete=ondelete),
        ),
    )
    Table("other", schema, Column("id", Integer, primary_key=True))
    return schema


def test_the_reflection_finds_the_tables_that_point_at_a_payment_method() -> None:
    assert referencing_tables(metadata) >= {"payment", "expense"}


def test_every_referencing_table_has_a_seeder_and_every_seeder_a_table() -> None:
    assert unseeded(metadata, SEEDERS) == set()


def test_a_new_referencing_table_with_no_seeder_is_reported() -> None:
    assert unseeded(_toy("RESTRICT"), {}) == {"booking"}
    assert unseeded(_toy("RESTRICT"), {"booking": _payment}) == set()
    assert unseeded(_toy("RESTRICT", referencing=False), {"booking": _payment}) == {"booking"}


@pytest.mark.parametrize("table", sorted(SEEDERS))
def test_a_method_a_record_of_this_table_points_at_is_in_use_and_cannot_be_deleted(
    client: TestClient, table: str
) -> None:
    method = int(client.post(METHODS, json={"name": f"Used by {table}"}).json()["id"])
    SEEDERS[table](client, method)

    listed = client.get(METHODS).json()

    assert next(m["in_use"] for m in listed if m["id"] == method) is True
    refused = client.delete(f"{METHODS}/{method}")
    assert refused.status_code == 409
    assert refused.json()["code"] == "payment_method.in_use"


def test_every_foreign_key_to_a_payment_method_is_restrict() -> None:
    assert not_restrict(metadata) == []


@pytest.mark.parametrize("ondelete", [None, "CASCADE", "SET NULL", "NO ACTION"])
def test_a_foreign_key_that_is_not_restrict_is_reported(ondelete: str | None) -> None:
    assert not_restrict(_toy(ondelete)) == ["booking: method_id"]
    assert not_restrict(_toy("RESTRICT")) == []
