"""The Catalog text is pinned (GH-318, ADR-0070): changing the screen word to Product must
not move a byte of what the Catalog says, nor make Upkeep send or edit anything.

Through `TestClient` over `/catalog` and `/pinned-catalog` with the fake Telegram adapter
and the movable clock; the expected texts are literals captured from the code before the
word change.
"""

from datetime import timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.clock import business_day
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely
from tests.conftest import MovableClock
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
FOOTER = "📩 Questions and orders by private message."
STOCKED_TEXT = f"🌿 **CATALOG** 🌿\n\n**Lemon Haze**\n• Price per gram: $9.000\n\n{FOOTER}"
STOCKED_SENT = f"🌿 CATALOG 🌿\n\nLemon Haze\n• Price per gram: $9.000\n\n{FOOTER}"
EMPTY_SENT = f"🌿 CATALOG 🌿\n\nNothing to offer for now.\n\n{FOOTER}"


def _publish(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    response = client.post("/pinned-catalog/publish")
    assert response.status_code == 200, response.text


def _seed_priced_and_stocked(client: TestClient) -> dict[str, Any]:
    product: dict[str, Any] = client.post("/api/products", json={"name": "Lemon Haze"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"product_id": product["id"], "origin": "opening_stock", "quantity": "50"},
    )
    return product


def test_the_catalog_text_of_one_priced_stocked_product_is_pinned(
    client: TestClient,
) -> None:
    _seed_priced_and_stocked(client)

    assert client.get("/catalog").json()["text"] == STOCKED_TEXT


def test_the_text_sent_for_one_priced_stocked_product_is_pinned(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _seed_priced_and_stocked(client)

    _publish(client)

    assert [call[3] for call in telegram.calls if call[0] == "send"] == [STOCKED_SENT] * 2


def test_the_text_sent_for_a_business_with_nothing_to_offer_is_pinned(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post("/api/products", json={"name": "Not Priced"})
    assert client.get("/catalog").json()["text"] is None

    _publish(client)

    assert [call[3] for call in telegram.calls if call[0] == "send"] == [EMPTY_SENT] * 2


def test_upkeep_over_a_published_catalog_sends_and_edits_nothing(
    app: FastAPI, client: TestClient, clock: MovableClock, telegram: FakeTelegram
) -> None:
    _seed_priced_and_stocked(client)
    _publish(client)
    telegram.calls.clear()

    run_upkeep_safely(app.state, 1, business_day(clock()))
    clock.set(clock() + timedelta(days=1))
    run_upkeep_safely(app.state, 1, business_day(clock()))

    assert [call for call in telegram.calls if call[0] in ("send", "edit")] == []
