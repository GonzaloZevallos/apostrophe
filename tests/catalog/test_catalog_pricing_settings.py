"""The catalog text follows the business's pricing switches (CONTEXT.md: Catalog, Pricing
settings): the bulk line shows only while Precio por cantidad is on, and the VIP price is
never in the text, whatever the switches say. Through `GET /catalog` with the real
adapters, and the switches moved through the real `PUT /pricing-settings`.
"""

import pytest
from fastapi.testclient import TestClient

BULK_LINE = "• Desde 10 g: $10.000 c/u"
VIP_PRICE_TEXTS = ("$9.000", "9.000", "9000")


def _switch(client: TestClient, *, bulk: bool, vip: bool) -> None:
    response = client.put(
        "/pricing-settings", json={"is_bulk_pricing": bulk, "is_vip_customers": vip}
    )
    assert response.status_code == 200, response.text


def _bulk_priced_variety(client: TestClient, name: str, *, vip_price: int | None = None) -> None:
    # An entry stores nothing for a rule that is off (ADR-0034), so it is recorded with both on.
    _switch(client, bulk=True, vip=True)
    variety_id = client.post("/varieties", json={"name": name}).json()["id"]
    price = client.post(
        f"/varieties/{variety_id}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 11_000,
            "bulk_price": 10_000,
            "bulk_minimum": "10",
            "vip_price": vip_price,
        },
    )
    assert price.status_code == 201, price.text
    stock = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "50"},
    )
    assert stock.status_code == 201, stock.text
    _switch(client, bulk=False, vip=False)


def _text(client: TestClient) -> str:
    text = client.get("/catalog").json()["text"]
    assert isinstance(text, str)
    return text


@pytest.mark.parametrize(
    ("bulk", "vip"), [(False, False), (True, False), (False, True), (True, True)]
)
def test_the_bulk_line_follows_precio_por_cantidad_alone(
    client: TestClient, bulk: bool, vip: bool
) -> None:
    _bulk_priced_variety(client, "Gelato")
    _switch(client, bulk=bulk, vip=vip)

    text = _text(client)

    assert "• Precio x gramo: $11.000" in text
    assert (BULK_LINE in text) is bulk


@pytest.mark.parametrize(
    ("bulk", "vip"), [(False, False), (True, False), (False, True), (True, True)]
)
def test_the_vip_price_is_never_in_the_text(client: TestClient, bulk: bool, vip: bool) -> None:
    _bulk_priced_variety(client, "Gelato", vip_price=9_000)
    _switch(client, bulk=bulk, vip=vip)

    text = _text(client)

    assert not any(amount in text for amount in VIP_PRICE_TEXTS)
    assert "VIP" not in text


def test_a_switch_change_shows_on_the_next_read(client: TestClient) -> None:
    _bulk_priced_variety(client, "Gelato")
    _switch(client, bulk=True, vip=False)
    assert BULK_LINE in _text(client)

    _switch(client, bulk=False, vip=False)
    assert BULK_LINE not in _text(client)

    _switch(client, bulk=True, vip=False)
    assert BULK_LINE in _text(client)


def test_one_businesss_switches_never_change_anothers_text(
    client: TestClient, other_client: TestClient
) -> None:
    _bulk_priced_variety(client, "Gelato")
    _bulk_priced_variety(other_client, "Gelato")

    _switch(client, bulk=True, vip=False)
    _switch(other_client, bulk=False, vip=False)

    assert BULK_LINE in _text(client)
    assert BULK_LINE not in _text(other_client)

    _switch(client, bulk=False, vip=False)
    _switch(other_client, bulk=True, vip=False)

    assert BULK_LINE not in _text(client)
    assert BULK_LINE in _text(other_client)
