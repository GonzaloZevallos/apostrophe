"""Data a figures test enters through the routes, shared by the tests that compare figures
(docs/adr/0058): the same sales, payments, stock and expense in whichever business is
signed in."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import TODAY, reason_id

TODAY_TEXT = TODAY.isoformat()


def _cash(client: TestClient) -> int:
    """The first method the business offers: ids differ between two businesses."""
    return int(client.get("/api/payment-methods").json()[0]["id"])


def enter(client: TestClient) -> dict[str, Any]:
    """The same data in either business; answers the withdrawal's own answer."""
    cash = _cash(client)
    lavanda = client.post("/api/products", json={"name": "Lavanda"}).json()["id"]
    rosa = client.post("/api/products", json={"name": "Rosa"}).json()["id"]
    for product_id, price in ((lavanda, 10_000), (rosa, 3_333)):
        client.post(
            f"/api/products/{product_id}/prices",
            json={"effective_from": "2026-01-01", "list_price": price},
        )
    # A purchase with an uneven cost: 1000 over 3 does not divide.
    for product_id, quantity, cost in ((lavanda, "3", 1_000), (rosa, "10", 7_000)):
        entry = client.post(
            "/stock/entries",
            json={
                "product_id": product_id,
                "origin": "purchase",
                "quantity": quantity,
                "total_cost": cost,
            },
        )
        assert entry.status_code == 201, entry.text
    adjustment = client.post(
        "/stock/entries",
        json={"product_id": lavanda, "origin": "adjustment", "quantity": "-1"},
    )
    assert adjustment.status_code == 201, adjustment.text

    customer = client.post(
        "/customers", json={"name": "Ana", "phone": "11 5555-5555", "phone_country": "AR"}
    ).json()
    sales = [
        {
            "payment": {"kind": "paid", "payment_method_id": cash},
            "shipping_charged": 500,
            "lines": [{"product_id": lavanda, "quantity": "1"}],
        },
        {
            "payment": {"kind": "paid", "payment_method_id": cash},
            "lines": [
                {"product_id": rosa, "quantity": "1", "gift": True},
                {"product_id": rosa, "quantity": "2"},
            ],
        },
        {
            "payment": {"kind": "paid", "payment_method_id": cash},
            "lines": [{"product_id": lavanda, "quantity": "1", "special_price": 9_000}],
        },
        {
            "payment": {"kind": "owing"},
            "customer_id": customer["id"],
            "lines": [{"product_id": rosa, "quantity": "3"}],
        },
    ]
    for body in sales:
        made = client.post("/sales", json=body)
        assert made.status_code == 201, made.text
    paid = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY_TEXT, "amount": 4_000, "payment_method_id": cash},
    )
    assert paid.status_code == 201, paid.text

    category = client.post("/expense-categories", json={"name": "Envases"}).json()["id"]
    expense = client.post(
        "/expenses",
        json={"spent_on": TODAY_TEXT, "category_id": category, "amount": 1_500, "detail": "Cajas"},
    )
    assert expense.status_code == 201, expense.text

    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason_id": reason_id(client, "Marketing"),
            "lines": [{"product_id": rosa, "quantity": "2"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text
    # A second negative adjustment, so the shortfall is a sum of costed lots.
    shortfall = client.post(
        "/stock/entries", json={"product_id": rosa, "origin": "adjustment", "quantity": "-3"}
    )
    assert shortfall.status_code == 201, shortfall.text
    return {"withdrawal": withdrawal.json(), "customer_id": customer["id"]}


def enter_extras(client: TestClient, customer_id: int) -> None:
    """What `enter` leaves out: a later partial payment of what a customer owes, and a
    sale that draws from a stock entry whose cost is still pending."""
    cash = _cash(client)
    paid = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY_TEXT, "amount": 1_250, "payment_method_id": cash},
    )
    assert paid.status_code == 201, paid.text
    jazmin = client.post("/api/products", json={"name": "Jazmin"}).json()["id"]
    client.post(
        f"/api/products/{jazmin}/prices",
        json={"effective_from": "2026-01-01", "list_price": 2_500},
    )
    # No cost: the lot's cost is pending, and a draw from it carries no cost yet.
    entry = client.post(
        "/stock/entries", json={"product_id": jazmin, "origin": "adjustment", "quantity": "4"}
    )
    assert entry.status_code == 201, entry.text
    sale = client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": cash},
            "lines": [{"product_id": jazmin, "quantity": "2"}],
        },
    )
    assert sale.status_code == 201, sale.text
