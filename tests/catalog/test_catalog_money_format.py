"""The Catalog takes its money style from the Business (CONTEXT.md: Catalog, Money format):
through `GET /api/catalog` after `PUT /api/money-format`, and through `SqlCatalogVarieties`
over one planted price entry with cents, the one hand-built row (the products domain cannot
record cents yet)."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.text import CatalogEntry, catalog_text
from app.catalog.domain.words import CatalogWords
from app.shared.money import Money, MoneyFormat

DAY = date(2026, 10, 2)
WORDS = CatalogWords(
    nothing_to_offer="Nothing.",
    indica=lambda indica, sativa: f"{indica}/{sativa}",
    aroma=lambda aroma: aroma,
    price_per_gram=lambda price: price,
    bulk=lambda quantity, price: f"{quantity} {price}",
)


def _priced_and_stocked(client: TestClient) -> int:
    product_id: int = client.post("/api/products", json={"name": "Lavanda"}).json()["id"]
    priced = client.post(
        f"/api/products/{product_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    assert priced.status_code == 201, priced.text
    stocked = client.post(
        "/stock/entries",
        json={"product_id": product_id, "origin": "opening_stock", "quantity": "50"},
    )
    assert stocked.status_code == 201, stocked.text
    return product_id


def _catalog_line(client: TestClient) -> str:
    response = client.get("/catalog")
    body = response.json()["text"]
    (line,) = [line for line in body.splitlines() if "11" in line]
    return str(line)


def test_the_defaults_write_the_dollar_and_whole_pesos(client: TestClient) -> None:
    _priced_and_stocked(client)

    assert _catalog_line(client) == "• Price per gram: $11.000"


def test_a_new_symbol_is_what_the_catalog_prints(client: TestClient) -> None:
    _priced_and_stocked(client)

    assert client.put("/api/money-format", json={"symbol": "US$", "decimals": 0}).status_code == 200

    assert _catalog_line(client) == "• Price per gram: US$11.000"


def test_a_price_with_cents_is_read_and_written_with_its_cents(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    if money_scale != 2:
        pytest.skip("a price with cents is stored only by a business at scale 2")
    product_id = _priced_and_stocked(client)
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE price_entry SET list_price = 1100050 WHERE variety_id = :v"),
            {"v": product_id},
        )
    with Session(engine) as session:
        business_id = int(session.execute(text("SELECT id FROM business")).scalar_one())
        (shown,) = SqlCatalogVarieties(session, business_id).on(DAY)

    assert shown.price is not None
    assert shown.price.list_price == Money(1_100_050)
    entry = CatalogEntry(name="Lavanda", attributes=CatalogAttributes.default(), price=shown.price)
    assert catalog_text(WORDS, MoneyFormat("US$", 2), "", "", [entry]) == (
        "**Lavanda**\nUS$11.000,50"
    )
