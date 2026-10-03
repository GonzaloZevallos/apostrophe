"""`GET /sales/{id}`'s own cost-of-goods shape (ADR-0009, CODING_STANDARDS section 5):
each line's `cost` is allocated fresh from stock's lots, through the `LineCosts` port
wired in `app/main.py` onto `app.state.line_costs`. The list route (`SaleOut`) never
carries this field and never allocates; that stays covered by `test_sales_router.py`.
"""

from typing import Any

from fastapi.testclient import TestClient


def _variety(client: TestClient, list_price: int = 10_000) -> int:
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return int(variety["id"])


def _entry(client: TestClient, variety_id: int, **overrides: Any) -> None:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": "purchase", "grams": "5"}
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _sale(client: TestClient, variety_id: int, grams: str = "10") -> int:
    response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": grams}]},
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def test_a_fully_costed_line_answers_its_cost_and_no_pending_grams(
    client: TestClient,
) -> None:
    variety_id = _variety(client)
    _entry(client, variety_id, grams="10", total_cost=5_000)

    sale_id = _sale(client, variety_id)

    response = client.get(f"/sales/{sale_id}")

    assert response.status_code == 200, response.text
    assert response.json()["lines"] == [
        {
            "variety_id": variety_id,
            "variety_name": "Lavanda",
            "grams": 10.0,
            "pricing_rule": "list",
            "price_per_gram": 10_000,
            "line_total": 100_000,
            "cost": {"costed": 5_000, "pending_grams": 0.0},
        }
    ]


def test_a_line_with_no_lot_behind_it_is_entirely_pending_never_a_zero_cost(
    client: TestClient,
) -> None:
    """Enforcement seam: `LineCost.costed` must stay `None`, never `0`, when nothing of
    the draw is costed (a stock invariant this route must not paper over)."""
    variety_id = _variety(client)

    sale_id = _sale(client, variety_id)

    response = client.get(f"/sales/{sale_id}")

    cost = response.json()["lines"][0]["cost"]
    assert cost == {"costed": None, "pending_grams": 10.0}


def test_list_sales_never_carries_a_cost_field(client: TestClient) -> None:
    variety_id = _variety(client)
    _entry(client, variety_id, grams="10", total_cost=5_000)
    client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    )

    listed = client.get("/sales")

    assert listed.status_code == 200
    assert "cost" not in listed.json()[0]["lines"][0]


def test_recording_a_later_entry_moves_the_cost_the_next_time_it_is_read(
    client: TestClient,
) -> None:
    """ADR-0009: never frozen. The sale is read once with no lot behind it (pending),
    then again after a lot is recorded, and the second read reflects it without
    touching the sale's own price, total or payment."""
    variety_id = _variety(client)
    sale_id = _sale(client, variety_id)
    before = client.get(f"/sales/{sale_id}").json()
    assert before["lines"][0]["cost"] == {"costed": None, "pending_grams": 10.0}

    _entry(client, variety_id, grams="10", total_cost=4_000)

    after = client.get(f"/sales/{sale_id}").json()
    assert after["lines"][0]["cost"] == {"costed": 4_000, "pending_grams": 0.0}
    assert after["total"] == before["total"]
    assert after["lines"][0]["price_per_gram"] == before["lines"][0]["price_per_gram"]
