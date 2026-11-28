"""Pins the exact bytes of one `GET /analysis` and one `GET /panel` (seam: the two routes,
through `TestClient`, real adapters, the movable clock) before the ratio rounding moves
to `app/shared/ratio.py`.

The business is seeded through `client` only, on a fixed day, and the response body is
compared as raw bytes with the files in `tests/results/pins/`, once per `money_scale`.
The bytes are the same at both scales, so each route has one file. Nothing is masked:
ids come out the same because every test opens a fresh database.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import MovableClock
from tests.payment_body import payment_body

PINS = Path(__file__).parent / "pins"
SEEDED_AT = datetime(2026, 10, 15, 18, 0, tzinfo=UTC)
MONTH = "2026-10"


def _post(client: TestClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post(url, json=body)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def _seed(client: TestClient, clock: MovableClock) -> None:
    clock.set(SEEDED_AT)
    product = _post(client, "/api/products", {"name": "Criolla"})
    product_id = product["id"]
    _post(
        client,
        f"/api/products/{product_id}/prices",
        {"effective_from": "2020-01-01", "list_price": 10_000},
    )
    for origin, quantity, total_cost, day in (
        ("purchase", "30", 10_000, "2026-10-01"),
        ("purchase", "20", 7_000, "2026-10-01"),
        ("harvest", "10", 3_333, "2026-10-02"),
    ):
        _post(
            client,
            "/stock/entries",
            {
                "product_id": product_id,
                "origin": origin,
                "quantity": quantity,
                "total_cost": total_cost,
                "date": day,
            },
        )
    customer = _post(
        client,
        "/customers",
        {"name": "Ana", "phone": "11 5555-5555", "phone_country": "AR"},
    )
    _post(
        client,
        "/sales",
        {
            "date": "2026-10-05",
            "customer_id": customer["id"],
            "payment": payment_body("owing"),
            "lines": [
                {"product_id": product_id, "quantity": "7", "gift": False},
                {"product_id": product_id, "quantity": "2", "gift": True},
            ],
        },
    )
    # Draws past every Lot: the grams beyond the stock have no cost yet.
    _post(
        client,
        "/sales",
        {
            "date": "2026-10-06",
            "payment": payment_body("cash", client),
            "lines": [{"product_id": product_id, "quantity": "80", "gift": False}],
        },
    )
    _post(
        client,
        f"/customers/{customer['id']}/payments",
        {"paid_on": "2026-10-10", "amount": 40_000, "payment_method_id": 1},
    )
    category = _post(client, "/expense-categories", {"name": "Rent"})
    _post(
        client,
        "/expenses",
        {
            "spent_on": "2026-10-12",
            "category_id": category["id"],
            "amount": 5_000,
            "detail": "a pinned expense",
        },
    )


def test_analysis_bytes_are_pinned(client: TestClient, clock: MovableClock) -> None:
    _seed(client, clock)

    response = client.get("/analysis", params={"month": MONTH})

    assert response.status_code == 200, response.text
    assert response.content == (PINS / "analysis.json").read_bytes()


def test_panel_bytes_are_pinned(client: TestClient, clock: MovableClock) -> None:
    _seed(client, clock)

    response = client.get("/panel")

    assert response.status_code == 200, response.text
    assert response.content == (PINS / "panel.json").read_bytes()
