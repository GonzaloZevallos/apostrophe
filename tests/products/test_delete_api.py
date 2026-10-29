"""Deleting a variety, and the removal action its page offers, through the HTTP API
(docs/product/varieties.md): delete only with no history, guarded by the domain."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.fakes.archive import archive_by_hand


def _register(client: TestClient, name: str = "24K Gold") -> int:
    response = client.post("/api/products", json={"name": name})
    assert response.status_code == 201, response.text
    variety_id: int = response.json()["id"]
    return variety_id


def _price(client: TestClient, variety_id: int) -> None:
    response = client.post(
        f"/api/products/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    assert response.status_code == 201, response.text


def _entry(client: TestClient, variety_id: int, origin: str, quantity: str) -> int:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": origin, "quantity": quantity}
    if origin == "purchase":
        body["total_cost"] = 5_000
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    entry_id: int = response.json()["id"]
    return entry_id


def _sale(client: TestClient, variety_id: int, **line: Any) -> int:
    _price(client, variety_id)
    body = {"lines": [{"variety_id": variety_id, "quantity": "1", **line}], "payment": "cash"}
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    sale_id: int = response.json()["id"]
    return sale_id


def _withdrawal(client: TestClient, variety_id: int, reason: str) -> int:
    # A withdrawal is never refused for lack of stock, so it alone can be the history.
    body = {"reason": reason, "lines": [{"variety_id": variety_id, "quantity": "1"}]}
    response = client.post("/stock/withdrawals", json=body)
    assert response.status_code == 201, response.text
    withdrawal_id: int = response.json()["id"]
    return withdrawal_id


def _removal(client: TestClient, variety_id: int) -> str | None:
    response = client.get(f"/api/products/{variety_id}")
    assert response.status_code == 200, response.text
    removal: str | None = response.json()["removal"]
    return removal


HISTORY: dict[str, Callable[[TestClient, int], object]] = {
    "list line": lambda c, v: _sale(c, v),
    "gift": lambda c, v: _sale(c, v, gift=True),
    "special price": lambda c, v: _sale(c, v, special_price=500),
    "purchase": lambda c, v: _entry(c, v, "purchase", "10"),
    "harvest": lambda c, v: _entry(c, v, "harvest", "10"),
    "opening stock": lambda c, v: _entry(c, v, "opening_stock", "10"),
    "positive adjustment": lambda c, v: _entry(c, v, "adjustment", "3"),
    "negative adjustment": lambda c, v: _entry(c, v, "adjustment", "-3"),
    "promotion withdrawal": lambda c, v: _withdrawal(c, v, "promotion"),
    "own use withdrawal": lambda c, v: _withdrawal(c, v, "own_use"),
}


@pytest.mark.parametrize("source", list(HISTORY))
def test_each_source_of_history_alone_refuses_the_delete_and_offers_archive(
    client: TestClient, source: str
) -> None:
    variety_id = _register(client)
    HISTORY[source](client, variety_id)

    assert _removal(client, variety_id) == "archive"
    response = client.delete(f"/api/products/{variety_id}")

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "variety.has_history"
    assert "24K" not in response.text
    assert client.get(f"/api/products/{variety_id}").status_code == 200


def test_a_variety_with_no_history_is_offered_delete_and_deleted(client: TestClient) -> None:
    variety_id = _register(client)

    assert _removal(client, variety_id) == "delete"
    response = client.delete(f"/api/products/{variety_id}")

    assert response.status_code == 204, response.text
    assert client.get(f"/api/products/{variety_id}").status_code == 404
    assert client.get("/api/products").json() == []


def test_prices_a_threshold_and_attributes_alone_leave_delete_offered_and_go_with_it(
    client: TestClient,
) -> None:
    variety_id = _register(client)
    _price(client, variety_id)
    assert (
        client.put(f"/stock/varieties/{variety_id}/threshold", json={"quantity": "5"}).status_code
        == 200
    )
    attributes = client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": True, "emoji": None, "indica_share": 50, "aroma": "dulce"},
    )
    assert attributes.status_code == 200, attributes.text

    assert _removal(client, variety_id) == "delete"
    assert client.delete(f"/api/products/{variety_id}").status_code == 204
    # The name is free at once and the new variety starts clean.
    again = _register(client)
    assert _removal(client, again) == "delete"
    assert client.get(f"/api/products/{again}/prices").json() == []


def test_deleting_the_last_entry_offers_delete_again(client: TestClient) -> None:
    variety_id = _register(client)
    entry_id = _entry(client, variety_id, "harvest", "10")
    assert _removal(client, variety_id) == "archive"

    assert client.delete(f"/stock/entries/{entry_id}").status_code == 204

    assert _removal(client, variety_id) == "delete"


def test_deleting_the_last_withdrawal_offers_delete_again(client: TestClient) -> None:
    variety_id = _register(client)
    withdrawal_id = _withdrawal(client, variety_id, "own_use")
    assert _removal(client, variety_id) == "archive"

    assert client.delete(f"/stock/withdrawals/{withdrawal_id}").status_code == 204

    assert _removal(client, variety_id) == "delete"


def test_deleting_the_last_sale_offers_delete_again(client: TestClient) -> None:
    variety_id = _register(client)
    sale_id = _sale(client, variety_id)
    assert _removal(client, variety_id) == "archive"

    assert client.delete(f"/sales/{sale_id}").status_code == 200

    assert _removal(client, variety_id) == "delete"


@pytest.mark.parametrize("with_history", [True, False])
def test_an_archived_variety_offers_nothing_and_is_not_deleted(
    client: TestClient, with_history: bool
) -> None:
    variety_id = _register(client)
    if with_history:
        _entry(client, variety_id, "harvest", "10")
    client.post(f"/api/products/{variety_id}/archive")

    assert _removal(client, variety_id) is None
    response = client.delete(f"/api/products/{variety_id}")

    assert response.status_code == 404
    assert response.json()["code"] == "variety.archived"


def test_a_restored_variety_whose_history_went_away_offers_delete(client: TestClient) -> None:
    variety_id = _register(client)
    entry_id = _entry(client, variety_id, "harvest", "10")
    client.post(f"/api/products/{variety_id}/archive")
    client.delete(f"/stock/entries/{entry_id}")

    client.post(f"/api/products/{variety_id}/restore")

    assert _removal(client, variety_id) == "delete"


def test_a_missing_variety_answers_not_found_and_the_list_carries_no_removal(
    client: TestClient,
) -> None:
    response = client.delete("/api/products/999")

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"
    _register(client)
    assert "removal" not in client.get("/api/products").json()[0]


def test_a_deleted_variety_is_gone_from_every_reader_of_another_business_untouched(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    mine = _register(client, "Mine")
    theirs = _register(other_client, "Mine")
    archive_by_hand(engine, theirs)

    assert client.delete(f"/api/products/{mine}").status_code == 204

    assert other_client.get("/api/products", params={"archived": "true"}).json()[0]["name"] == "Mine"
