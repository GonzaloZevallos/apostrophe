"""The cost and margins on `GET /api/products/{id}` (GH-522, docs/product/cost-and-margins.md):
the latest costed Purchase of a product against each price the business uses.

Everything is set up through the API, at both stored money scales (`money_scale`), except
the VIP type, which only the upgrade or the import makes (docs/adr/0070)."""

from datetime import date, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.clock import business_day
from tests.conftest import MovableClock
from tests.vip_type import make_type

PENDING: dict[str, Any] = {"amount": None, "margins": []}


def _product(client: TestClient, name: str = "Gold") -> int:
    response = client.post("/api/products", json={"name": name})
    assert response.status_code == 201, response.text
    product_id: int = response.json()["id"]
    return product_id


def _price(client: TestClient, product_id: int, list_price: float, **extra: Any) -> dict[str, Any]:
    response = client.post(
        f"/api/products/{product_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price, **extra},
    )
    assert response.status_code == 201, response.text
    entry: dict[str, Any] = response.json()
    return entry


def _entry_body(
    product_id: int, origin: str, quantity: str, total_cost: float | None, **extra: Any
) -> dict[str, Any]:
    return {
        "product_id": product_id,
        "origin": origin,
        "quantity": quantity,
        **({} if total_cost is None else {"total_cost": total_cost}),
        **extra,
    }


def _record(
    client: TestClient,
    product_id: int,
    quantity: str,
    total_cost: float | None,
    origin: str = "purchase",
    **extra: Any,
) -> int:
    response = client.post(
        "/stock/entries", json=_entry_body(product_id, origin, quantity, total_cost, **extra)
    )
    assert response.status_code == 201, response.text
    entry_id: int = response.json()["id"]
    return entry_id


def _cost(client: TestClient, product_id: int) -> Any:
    response = client.get(f"/api/products/{product_id}")
    assert response.status_code == 200, response.text
    return response.json()["cost"]


def _decimals(client: TestClient, decimals: int) -> None:
    response = client.put("/api/money-format", json={"symbol": "$", "decimals": decimals})
    assert response.status_code == 200, response.text


def _switches(client: TestClient, *, bulk: bool, vip: bool) -> None:
    response = client.put(
        "/pricing-settings", json={"is_bulk_pricing": bulk, "is_vip_customers": vip}
    )
    assert response.status_code == 200, response.text


def _rules(cost: Any) -> list[tuple[str, int]]:
    return [(m["rule"], m["percent"]) for m in cost["margins"]]


def _tomorrow(clock: MovableClock) -> date:
    return business_day(clock()) + timedelta(days=1)


def test_the_cost_per_unit_follows_the_decimals_and_the_percent_does_not(
    client: TestClient,
) -> None:
    product_id = _product(client)
    _price(client, product_id, 11_000)
    _record(client, product_id, "30", 10_000)

    assert _cost(client, product_id) == {
        "amount": 333,
        "margins": [{"rule": "list", "percent": 97}],
    }

    _decimals(client, 2)

    assert _cost(client, product_id) == {
        "amount": 333.33,
        "margins": [{"rule": "list", "percent": 97}],
    }


def test_the_margin_comes_from_the_exact_cost_not_the_rounded_one(client: TestClient) -> None:
    # $1 for 2 g is 0.50 a gram: shown as 1 at 0 decimals, but the margin against 3 is 83, not 67.
    product_id = _product(client)
    _price(client, product_id, 3)
    _record(client, product_id, "2", 1)

    assert _cost(client, product_id) == {
        "amount": 1,
        "margins": [{"rule": "list", "percent": 83}],
    }


def test_a_fractional_quantity_is_read_in_grams_not_hundredths(client: TestClient) -> None:
    product_id = _product(client)
    _price(client, product_id, 5)
    _record(client, product_id, "2.5", 10)

    assert _cost(client, product_id) == {"amount": 4, "margins": [{"rule": "list", "percent": 20}]}

    _decimals(client, 2)

    assert _cost(client, product_id) == {
        "amount": 4.0,
        "margins": [{"rule": "list", "percent": 20}],
    }


def test_of_two_purchases_on_one_date_the_later_recorded_wins(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)
    clock.set(clock() + timedelta(minutes=5))
    _record(client, product_id, "1", 60)

    assert _cost(client, product_id)["amount"] == 60


def test_a_purchase_dated_tomorrow_is_ignored_once_the_clock_moves_back(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)
    start = clock()
    clock.set(start + timedelta(days=1))
    _record(client, product_id, "1", 70)
    assert _cost(client, product_id)["amount"] == 70

    clock.set(start)

    assert _cost(client, product_id)["amount"] == 40


def test_editing_then_deleting_the_latest_purchase_moves_the_cost(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)
    clock.set(clock() + timedelta(minutes=5))
    latest = _record(client, product_id, "1", 60)

    edited = client.put(
        f"/stock/entries/{latest}", json=_entry_body(product_id, "purchase", "2", 50)
    )
    assert edited.status_code == 200, edited.text
    assert _cost(client, product_id)["amount"] == 25

    assert client.delete(f"/stock/entries/{latest}").status_code == 204
    assert _cost(client, product_id)["amount"] == 40


def test_deleting_the_only_purchase_leaves_the_cost_pending(client: TestClient) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    only = _record(client, product_id, "1", 40)

    assert client.delete(f"/stock/entries/{only}").status_code == 204

    assert _cost(client, product_id) == PENDING


def test_a_product_with_no_purchase_has_a_pending_cost(client: TestClient) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)

    assert _cost(client, product_id) == PENDING


def test_a_harvest_or_an_opening_stock_with_a_cost_leaves_the_cost_pending(
    client: TestClient,
) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "10", 500, origin="harvest")
    _record(client, product_id, "10", 500, origin="opening_stock")

    assert _cost(client, product_id) == PENDING


def test_with_no_price_today_the_cost_shows_and_there_are_no_margins(client: TestClient) -> None:
    product_id = _product(client)
    _record(client, product_id, "30", 10_000)

    assert _cost(client, product_id) == {"amount": 333, "margins": []}


def test_a_price_dated_tomorrow_gives_no_margin_today(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    client.post(
        f"/api/products/{product_id}/prices",
        json={"effective_from": _tomorrow(clock).isoformat(), "list_price": 100},
    )
    _record(client, product_id, "1", 40)

    assert _cost(client, product_id) == {"amount": 40, "margins": []}


def test_the_bulk_margin_follows_the_bulk_price_setting(client: TestClient) -> None:
    _switches(client, bulk=True, vip=False)
    product_id = _product(client)
    _price(client, product_id, 100, bulk_price=80, bulk_minimum=10)
    _record(client, product_id, "1", 40)

    assert _rules(_cost(client, product_id)) == [("list", 60), ("bulk", 50)]

    _switches(client, bulk=False, vip=False)
    assert _rules(_cost(client, product_id)) == [("list", 60)]

    _switches(client, bulk=True, vip=False)
    assert _rules(_cost(client, product_id)) == [("list", 60), ("bulk", 50)]


def test_the_vip_margin_comes_last_and_follows_the_switch_and_the_type(
    client: TestClient, engine: Engine
) -> None:
    # A VIP type comes only from the upgrade or the import, never from a route (docs/adr/0070):
    # this is the one hand-built row of these tests.
    _switches(client, bulk=True, vip=True)
    vip_type = make_type(engine, is_vip=True)
    product_id = _product(client)
    _price(client, product_id, 100, bulk_price=80, bulk_minimum=10, vip_price=70)
    _record(client, product_id, "1", 40)

    assert _rules(_cost(client, product_id)) == [("list", 60), ("bulk", 50), ("vip", 43)]

    _switches(client, bulk=True, vip=False)
    assert _rules(_cost(client, product_id)) == [("list", 60), ("bulk", 50)]

    _switches(client, bulk=True, vip=True)
    assert _rules(_cost(client, product_id)) == [("list", 60), ("bulk", 50), ("vip", 43)]

    assert client.delete(f"/api/customer-types/{vip_type}").status_code == 204
    assert _rules(_cost(client, product_id)) == [("list", 60), ("bulk", 50)]


def test_a_type_named_vip_made_through_the_api_gives_no_vip_margin(client: TestClient) -> None:
    _switches(client, bulk=False, vip=True)
    created = client.post("/api/customer-types", json={"name": "VIP", "icon": "star"})
    assert created.status_code == 201, created.text
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)

    assert _rules(_cost(client, product_id)) == [("list", 60)]


def test_a_hidden_product_shows_its_cost(client: TestClient) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)
    hidden = client.put(
        f"/catalog/products/{product_id}",
        json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert hidden.status_code == 200, hidden.text

    assert _cost(client, product_id) == {"amount": 40, "margins": [{"rule": "list", "percent": 60}]}


def test_an_archived_product_has_no_cost_and_restoring_it_brings_it_back(
    client: TestClient,
) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)

    assert client.post(f"/api/products/{product_id}/archive").status_code == 200
    assert _cost(client, product_id) is None

    assert client.post(f"/api/products/{product_id}/restore").status_code == 200
    assert _cost(client, product_id) == {"amount": 40, "margins": [{"rule": "list", "percent": 60}]}


def test_a_cost_above_the_price_gives_a_negative_margin(client: TestClient) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 150)

    assert _rules(_cost(client, product_id)) == [("list", -50)]


def test_the_product_list_carries_no_cost(client: TestClient) -> None:
    product_id = _product(client)
    _price(client, product_id, 100)
    _record(client, product_id, "1", 40)

    listed = client.get("/api/products").json()

    assert [item["id"] for item in listed] == [product_id]
    assert all("cost" not in item for item in listed)
