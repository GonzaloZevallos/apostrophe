"""The Catalog text follows the business's money format (GH-318): a second golden with `US$`
and 2 decimals beside the pinned `$`/0 one in `test_catalog_text_pinned`, through
`catalog_text` and through `GET /catalog` and the pinned catalog's publishable path."""

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.catalog.domain.text import catalog_text, pinned_catalog_text
from app.shared.money import MoneyFormat
from tests.catalog.reference_texts import entry
from tests.catalog.test_text import ENGLISH_WORDS
from tests.fakes.telegram import FakeTelegram

US_DOLLARS = MoneyFormat(symbol="US$", decimals=2)
FOOTER = "📩 Questions and orders by private message."
GOLDEN = (
    "🌿 **CATALOG** 🌿\n\n**Lemon Haze**\n• Price per gram: US$9.000,00\n"
    "• From 2,5 g: US$8.000,00 each\n\n" + FOOTER
)
GOLDEN_SENT = GOLDEN.replace("**", "")
SINGLE = f"🌿 **CATALOG** 🌿\n\n**Lemon Haze**\n• Price per gram: US$9.000,00\n\n{FOOTER}"
SINGLE_SENT = SINGLE.replace("**", "")
TOKEN = "123456789:top-secret-bot-token"


def test_the_domain_text_writes_the_symbol_attached_with_two_padded_decimals() -> None:
    lemon = entry("Lemon Haze", list_price=9000, bulk_price=8000, bulk_minimum="2.5")

    written = catalog_text(ENGLISH_WORDS, US_DOLLARS, "🌿 **CATALOG** 🌿", FOOTER, [lemon])

    assert written == GOLDEN
    assert pinned_catalog_text(ENGLISH_WORDS, US_DOLLARS, "", "", []) == "Nothing to offer for now."


def test_get_catalog_and_the_published_text_follow_the_business_format(
    client: TestClient, engine: Engine, telegram: FakeTelegram
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE money_format SET symbol = 'US$', decimals = 2, scale = 2"
                " WHERE business_id = 1"
            )
        )
    product = client.post("/api/products", json={"name": "Lemon Haze"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"product_id": product["id"], "origin": "opening_stock", "quantity": "50"},
    )

    shown = client.get("/catalog").json()["text"]
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")

    assert shown == SINGLE
    assert SINGLE_SENT in [call[3] for call in telegram.calls if call[0] == "send"]
