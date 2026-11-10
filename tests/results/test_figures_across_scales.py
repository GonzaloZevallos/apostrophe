"""The figures are the same at scale 0 and at scale 2 (docs/adr/0058).

Seam: the results HTTP routes (`/panel`, `/analysis`) and the routes that answer a balance,
through `TestClient`. One installation holds two businesses, one opened at scale 0 and one
at scale 2 through the app's own opening wiring; both enter the same data and every
figure, the ones that divide included, must come out equal. The two scales are opened here
on purpose, whatever the suite's `SCALES` is.
"""

from __future__ import annotations

from contextlib import ExitStack
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.main import create_app
from tests.conftest import (
    SETTINGS,
    TEST_HASHER,
    TODAY,
    MovableClock,
    open_business,
    reason_id,
    signed_in,
)
from tests.fakes.telegram import FakeTelegram

TODAY_TEXT = TODAY.isoformat()


def _enter(client: TestClient) -> dict[str, Any]:
    """The same data in either business; answers the withdrawal's own answer."""
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

    customer = client.post("/customers", json={"name": "Ana", "phone": "11 5555-5555"}).json()
    sales = [
        {
            "payment": "cash",
            "shipping_charged": 500,
            "lines": [{"product_id": lavanda, "quantity": "1"}],
        },
        {
            "payment": "cash",
            "lines": [
                {"product_id": rosa, "quantity": "1", "gift": True},
                {"product_id": rosa, "quantity": "2"},
            ],
        },
        {
            "payment": "cash",
            "lines": [{"product_id": lavanda, "quantity": "1", "special_price": 9_000}],
        },
        {
            "payment": "owing",
            "customer_id": customer["id"],
            "lines": [{"product_id": rosa, "quantity": "3"}],
        },
    ]
    for body in sales:
        made = client.post("/sales", json=body)
        assert made.status_code == 201, made.text
    paid = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY_TEXT, "amount": 4_000, "method": "cash"},
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
    return {"withdrawal": withdrawal.json(), "customer_id": customer["id"]}


def _without_ids(node: Any) -> Any:
    """The same body with every record id dropped: two businesses on one database never
    share an id, and an id is not a figure."""
    if isinstance(node, dict):
        return {
            key: _without_ids(value)
            for key, value in node.items()
            if key != "id" and not key.endswith("_id")
        }
    if isinstance(node, list):
        return [_without_ids(item) for item in node]
    return node


def _scales(engine: Engine) -> list[int]:
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT scale FROM money_format ORDER BY business_id")).all()
    return [int(row[0]) for row in rows]


def test_every_figure_is_the_same_at_scale_0_and_scale_2(
    engine: Engine, clock: MovableClock
) -> None:
    with ExitStack() as stack:
        clients = []
        for scale, name, email in ((0, "Cero", "cero@example.com"), (2, "Dos", "dos@example.com")):
            app = create_app(
                SETTINGS,
                engine=engine,
                clock=clock,
                hasher=TEST_HASHER,
                telegram=FakeTelegram(),
                upkeep_ticker=False,
                opening_money_scale=scale,
            )
            opened = stack.enter_context(TestClient(app))
            clients.append(signed_in(opened, open_business(opened, engine, clock, name, email)))
        zero, two = clients
        assert _scales(engine) == [0, 2]

        entered = [_enter(zero), _enter(two)]

        for path in ("/panel", "/analysis"):
            at_zero, at_two = zero.get(path), two.get(path)
            assert (at_zero.status_code, at_two.status_code) == (200, 200), path
            assert _without_ids(at_zero.json()) == _without_ids(at_two.json()), path
        # The data really moved money: sales, an expense, a cost of goods and an owed balance.
        month = zero.get("/panel").json()["periods"]["month"]
        assert month["sales"] > 0 and month["expenses"] == 1_500 and month["cost_of_goods"] > 0
        assert _without_ids(entered[0]["withdrawal"]) == _without_ids(entered[1]["withdrawal"])
        # Total owed, a customer's balance and the debtors list.
        owed = [client.get("/panel").json()["debts"] for client in clients]
        balances = [
            client.get(f"/customers/{done['customer_id']}").json()["balance"]
            for client, done in zip(clients, entered, strict=True)
        ]
        assert _without_ids(owed[0]) == _without_ids(owed[1])
        assert owed[0]["total_owed"] == 5_999
        assert balances == [5_999, 5_999]
        assert _without_ids(zero.get("/customers").json()) == _without_ids(
            two.get("/customers").json()
        )
        # Figures that divide: the same whole unit at both scales, never a hundredth.
        months = [client.get("/analysis").json()["month"] for client in clients]
        assert _without_ids(months[0]["average_margin"]) == _without_ids(
            months[1]["average_margin"]
        )
        assert _without_ids(months[0]["products"]) == _without_ids(months[1]["products"])
        averages = [
            client.get("/panel").json()["periods"]["month"]["average_sale"] for client in clients
        ]
        assert averages[0] == averages[1]
        assert isinstance(averages[0], int)
