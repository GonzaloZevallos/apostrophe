"""`GET /stock` and `PUT /stock/varieties/{variety_id}/threshold` through the HTTP API,
over a real database (CODING_STANDARDS section 5): the one place a variety's grams,
status and days left are computed is `stock_level` over `lots_and_draws`, read here only
through the routes' own answers.
"""

from typing import Any

from fastapi.testclient import TestClient

TODAY = "2026-10-02"


def _variety_id(client: TestClient, name: str = "Zkittlez") -> int:
    return int(client.post("/varieties", json={"name": name}).json()["id"])


def _record(client: TestClient, variety_id: int, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": "opening_stock", "grams": "50"}
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def _variety_row(stock: dict[str, Any], variety_id: int) -> dict[str, Any]:
    rows = [row for row in stock["varieties"] if row["variety_id"] == variety_id]
    assert len(rows) == 1, stock
    row: dict[str, Any] = rows[0]
    return row


def test_a_fresh_business_has_no_stock(client: TestClient) -> None:
    stock = client.get("/stock").json()

    assert stock["total"] == 0.0
    assert stock["varieties"] == []
    assert stock["entries"] == []


def test_a_variety_with_no_entries_reads_no_entries(client: TestClient) -> None:
    variety_id = _variety_id(client)

    stock = client.get("/stock").json()

    row = _variety_row(stock, variety_id)
    assert row["status"] == "no_entries"
    assert row["grams"] == 0.0
    assert row["days_left"] is None


def test_an_entry_shows_up_in_grams_total_and_entries(client: TestClient) -> None:
    variety_id = _variety_id(client)
    entry = _record(client, variety_id, grams="50")

    stock = client.get("/stock").json()

    row = _variety_row(stock, variety_id)
    assert row["status"] == "ok"
    assert row["grams"] == 50.0
    assert stock["total"] == 50.0
    assert stock["entries"][0]["id"] == entry["id"]


def test_a_variety_at_or_below_zero_reads_sold_out(client: TestClient) -> None:
    variety_id = _variety_id(client)
    _record(client, variety_id, grams="10")
    _record(client, variety_id, origin="adjustment", grams="-10")

    stock = client.get("/stock").json()

    row = _variety_row(stock, variety_id)
    assert row["status"] == "sold_out"
    assert row["sold_out_since"] == TODAY
    assert row["grams"] == 0.0


def test_setting_a_threshold_makes_low_stock_show_up(client: TestClient) -> None:
    variety_id = _variety_id(client)
    _record(client, variety_id, grams="10")

    set_response = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "20"})

    assert set_response.status_code == 200, set_response.text
    body = set_response.json()
    assert body["variety_id"] == variety_id
    assert body["threshold"] == 20.0
    assert body["status"] == "low"

    stock = client.get("/stock").json()
    assert _variety_row(stock, variety_id)["threshold"] == 20.0


def test_turning_off_a_threshold_is_idempotent(client: TestClient) -> None:
    variety_id = _variety_id(client)
    client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "20"})

    first_off = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": None})
    second_off = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": None})

    assert first_off.status_code == 200
    assert first_off.json()["threshold"] is None
    assert second_off.status_code == 200
    assert second_off.json()["threshold"] is None


def test_a_zero_threshold_is_refused(client: TestClient) -> None:
    variety_id = _variety_id(client)

    response = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "0"})

    assert response.status_code == 422
    assert response.json()["code"] == "stock.threshold_invalid"


def test_an_unknown_variety_threshold_is_not_found(client: TestClient) -> None:
    response = client.put("/stock/varieties/999999/threshold", json={"grams": "10"})

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"


def test_a_foreign_variety_threshold_answers_the_same_404(
    client: TestClient, other_client: TestClient
) -> None:
    foreign_variety = _variety_id(other_client)

    response = client.put(f"/stock/varieties/{foreign_variety}/threshold", json={"grams": "10"})

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"
