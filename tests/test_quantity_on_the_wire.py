"""The wire says quantity, never grams (GH-318 part 4): no property of the API document
carries the word, and a body still written with the old name is refused, changing nothing."""

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient


def _property_names(node: Any) -> set[str]:
    """Every key under any `properties` mapping, however deeply the schema nests."""
    names: set[str] = set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "properties" and isinstance(value, dict):
                names.update(value)
            names.update(_property_names(value))
    elif isinstance(node, list):
        for item in node:
            names.update(_property_names(item))
    return names


def _variety(client: TestClient) -> int:
    return int(client.post("/varieties", json={"name": "Zkittlez"}).json()["id"])


def _threshold_of(client: TestClient, variety_id: int) -> Any:
    rows = client.get("/stock").json()["varieties"]
    return next(row for row in rows if row["variety_id"] == variety_id)["threshold"]


def test_no_property_of_the_api_document_contains_grams(app: FastAPI) -> None:
    names = _property_names(app.openapi())

    assert "quantity" in names
    assert sorted(name for name in names if "grams" in name) == []


def test_a_property_name_check_sees_a_grams_property() -> None:
    document: dict[str, Any] = {
        "components": {"schemas": {"X": {"properties": {"pending_grams": {}}}}}
    }

    assert "pending_grams" in _property_names(document)


def test_a_stock_entry_written_with_grams_is_refused(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/stock/entries", json={"variety_id": variety_id, "origin": "opening_stock", "grams": "5"}
    )

    assert response.status_code == 422
    assert client.get("/stock").json()["entries"] == []


def test_a_sale_line_written_with_grams_is_refused(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "1"}]}
    )

    assert response.status_code == 422
    assert client.get("/sales").json() == []


def test_a_threshold_written_with_grams_is_refused_and_keeps_the_old_one(
    client: TestClient,
) -> None:
    variety_id = _variety(client)
    url = f"/stock/varieties/{variety_id}/threshold"
    assert client.put(url, json={"quantity": "15"}).status_code == 200

    response = client.put(url, json={"grams": "20"})

    assert response.status_code == 422
    assert _threshold_of(client, variety_id) == 15.0


def test_an_empty_threshold_body_is_refused_and_keeps_the_old_one(client: TestClient) -> None:
    variety_id = _variety(client)
    url = f"/stock/varieties/{variety_id}/threshold"
    assert client.put(url, json={"quantity": "15"}).status_code == 200

    response = client.put(url, json={})

    assert response.status_code == 422
    assert _threshold_of(client, variety_id) == 15.0


def test_a_null_quantity_turns_the_threshold_off(client: TestClient) -> None:
    variety_id = _variety(client)
    url = f"/stock/varieties/{variety_id}/threshold"
    assert client.put(url, json={"quantity": "15"}).status_code == 200

    response = client.put(url, json={"quantity": None})

    assert response.status_code == 200
    assert _threshold_of(client, variety_id) is None
