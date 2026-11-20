"""`GET /payments/debtors?with_lines=true`: each Debtor's Sales still owing, oldest first in
Settlement order (CONTEXT.md: Sales still owing), read off the same pass as the Balance.

Seam: the HTTP API through `TestClient`, moving the app's clock.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import NOW, MovableClock

PRICE = 1_000


def _priced_variety(client: TestClient) -> int:
    variety: dict[str, int] = client.post("/api/products", json={"name": "Variety"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": PRICE},
    )
    return variety["id"]


def _customer(client: TestClient, name: str, phone: str) -> int:
    created = client.post("/customers", json={"name": name, "phone": phone, "phone_country": "AR"})
    assert created.status_code == 201, created.text
    customer_id: int = created.json()["id"]
    return customer_id


def _owing_sale(
    client: TestClient, customer_id: int, variety_id: int, quantity: int, on: str
) -> dict[str, Any]:
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "owing"},
            "date": on,
            "lines": [{"product_id": variety_id, "quantity": str(quantity)}],
        },
    )
    assert sale.status_code == 201, sale.text
    body: dict[str, Any] = sale.json()
    return body


def _pay(client: TestClient, customer_id: int, amount: int) -> None:
    paid = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-25", "amount": amount, "payment_method_id": 1},
    )
    assert paid.status_code == 201, paid.text


def _debtors(client: TestClient, query: str = "") -> dict[str, Any]:
    response = client.get(f"/payments/debtors{query}")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def _tick(clock: MovableClock, minutes: int) -> None:
    clock.set(NOW + timedelta(minutes=minutes))


def _seed(client: TestClient, clock: MovableClock) -> dict[str, Any]:
    """Ana owes four Sales recorded out of date order: two share a date, and the oldest by
    date is recorded last, so it holds the highest Sale number. Two later Payments settle that
    oldest Sale in full and part of the next. Beto owes one Sale; Carla holds a Credit."""
    variety_id = _priced_variety(client)
    ana = _customer(client, "Ana", "11 1000-0001")
    beto = _customer(client, "Beto", "11 1000-0002")
    carla = _customer(client, "Carla", "11 1000-0003")

    _tick(clock, 1)
    newer = _owing_sale(client, ana, variety_id, 4, "2026-09-20")
    _tick(clock, 2)
    middle = _owing_sale(client, ana, variety_id, 2, "2026-09-10")
    _tick(clock, 3)
    same_day = _owing_sale(client, ana, variety_id, 3, "2026-09-20")
    _tick(clock, 4)
    oldest = _owing_sale(client, ana, variety_id, 1, "2026-09-01")
    _tick(clock, 5)
    _pay(client, ana, 1_000)
    _tick(clock, 6)
    _pay(client, ana, 500)

    _tick(clock, 7)
    beto_sale = _owing_sale(client, beto, variety_id, 5, "2026-09-12")

    _tick(clock, 8)
    kept = _owing_sale(client, carla, variety_id, 2, "2026-09-05")
    removed = _owing_sale(client, carla, variety_id, 1, "2026-09-06")
    _pay(client, carla, kept["total"] + removed["total"])
    assert client.delete(f"/sales/{removed['id']}").status_code == 200
    assert client.get(f"/customers/{carla}/account").json()["standing"] == "credit"

    return {
        "ana": ana,
        "beto": beto,
        "carla": carla,
        "newer": newer,
        "middle": middle,
        "same_day": same_day,
        "oldest": oldest,
        "beto_sale": beto_sale,
    }


def test_the_lines_follow_the_settlement_and_add_up_to_the_balance(
    client: TestClient, clock: MovableClock
) -> None:
    seeded = _seed(client, clock)
    oldest, middle = seeded["oldest"], seeded["middle"]
    assert oldest["number"] > middle["number"], "the oldest Sale must hold the highest number"

    body = _debtors(client, "?with_lines=true")

    by_customer = {row["customer"]["id"]: row for row in body["debtors"]}
    assert set(by_customer) == {seeded["ana"], seeded["beto"]}
    # The oldest Sale is paid in full, the next by date is part paid, and the two Sales that
    # share a date follow in the order they were recorded.
    assert by_customer[seeded["ana"]]["still_owing"] == [
        {"sale_number": middle["number"], "date": "2026-09-10", "remaining": 1_500},
        {"sale_number": seeded["newer"]["number"], "date": "2026-09-20", "remaining": 4_000},
        {"sale_number": seeded["same_day"]["number"], "date": "2026-09-20", "remaining": 3_000},
    ]
    assert by_customer[seeded["beto"]]["still_owing"] == [
        {
            "sale_number": seeded["beto_sale"]["number"],
            "date": "2026-09-12",
            "remaining": 5_000,
        }
    ]


def test_every_debtor_has_lines_that_match_its_balance_and_since_and_the_count(
    client: TestClient, clock: MovableClock
) -> None:
    _seed(client, clock)

    body = _debtors(client, "?with_lines=true")

    assert body["debtors"] != []
    for debtor in body["debtors"]:
        lines = debtor["still_owing"]
        assert lines, debtor
        assert sum(line["remaining"] for line in lines) == debtor["balance"]
        assert lines[0]["date"] == debtor["owing_since"]
        assert all(line["remaining"] > 0 for line in lines)
    assert sum(len(row["still_owing"]) for row in body["debtors"]) == body["sales_owing_count"]


def test_with_the_flag_off_still_owing_is_present_and_null_and_nothing_else_changes(
    client: TestClient, clock: MovableClock
) -> None:
    _seed(client, clock)

    default = _debtors(client)
    off = _debtors(client, "?with_lines=false")
    on = _debtors(client, "?with_lines=true")

    assert off == default
    assert all(row["still_owing"] is None for row in default["debtors"])
    assert all("still_owing" in row for row in default["debtors"])
    without_lines = [{k: v for k, v in row.items() if k != "still_owing"} for row in on["debtors"]]
    assert without_lines == [
        {k: v for k, v in row.items() if k != "still_owing"} for row in default["debtors"]
    ]
    assert {k: v for k, v in on.items() if k != "debtors"} == {
        k: v for k, v in default.items() if k != "debtors"
    }


def test_a_customer_with_a_credit_is_not_a_debtor_and_has_no_lines(
    client: TestClient, clock: MovableClock
) -> None:
    seeded = _seed(client, clock)

    body = _debtors(client, "?with_lines=true")

    assert seeded["carla"] not in [row["customer"]["id"] for row in body["debtors"]]


def test_a_value_that_is_not_a_boolean_is_a_validation_error(client: TestClient) -> None:
    response = client.get("/payments/debtors?with_lines=maybe")

    assert response.status_code == 422, response.text
    assert response.json()["detail"][0]["loc"] == ["query", "with_lines"]
