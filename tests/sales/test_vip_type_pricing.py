"""Sales read VIP membership from the customer's type (docs/adr/0059, docs/adr/0070), at
the HTTP seam over a real database. Price entry: list 1000, bulk 800 from 10, VIP price
700. A customer is VIP when its type is the business's VIP type, whatever any type is
called; the frozen `customer.vip` column is never read."""

import itertools
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from tests.pricing_switches import set_switches
from tests.vip_type import make_type, put_in_type


def _variety(client: TestClient, *, vip_price: int | None = 700) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    entry: dict[str, object] = {
        "effective_from": "2026-01-01",
        "list_price": 1_000,
        "bulk_price": 800,
        "bulk_minimum": "10",
    }
    if vip_price is not None:
        entry["vip_price"] = vip_price
    created = client.post(f"/api/products/{variety['id']}/prices", json=entry)
    assert created.status_code == 201, created.text
    return int(variety["id"])


_phones = itertools.count(1000)


def _customer(client: TestClient, name: str = "Juana") -> int:
    body = {"name": name, "phone": f"11 {next(_phones)}-0000"}
    return int(client.post("/customers", json=body).json()["id"])


def _sold(
    client: TestClient, product_id: int, customer_id: int | None, quantity: str
) -> dict[str, Any]:
    body: dict[str, object] = {
        "payment": {
            "kind": "method",
            "payment_method_id": client.get("/api/payment-methods").json()[0]["id"],
        },
        "lines": [{"product_id": product_id, "quantity": quantity}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    created = client.post("/sales", json=body)
    assert created.status_code == 201, created.text
    sale: dict[str, Any] = created.json()
    return sale


def _rule(sale: dict[str, Any]) -> tuple[str, int]:
    line = sale["lines"][0]
    return line["pricing_rule"], line["price_per_gram"]


def _setup(
    client: TestClient, engine: Engine, *, vip_price: int | None = 700
) -> tuple[int, int, int]:
    """(product, customer in the VIP type, the VIP type), the switches both on."""
    set_switches(engine, bulk=True, vip=True)
    product_id = _variety(client, vip_price=vip_price)
    vip_type = make_type(engine, is_vip=True)
    customer_id = _customer(client)
    put_in_type(engine, customer_id, vip_type)
    return product_id, customer_id, vip_type


def test_a_member_below_the_bulk_minimum_gets_the_vip_price(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine)

    assert _rule(_sold(client, product_id, customer_id, "5")) == ("vip", 700)


def test_a_member_above_the_bulk_minimum_gets_the_vip_price(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine)

    assert _rule(_sold(client, product_id, customer_id, "12")) == ("vip", 700)


def test_a_member_on_an_entry_without_a_vip_price_gets_list_then_bulk(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine, vip_price=None)

    assert _rule(_sold(client, product_id, customer_id, "5")) == ("list", 1_000)
    assert _rule(_sold(client, product_id, customer_id, "12")) == ("bulk", 800)


def test_a_customer_outside_the_vip_type_gets_bulk_at_twelve(
    client: TestClient, engine: Engine
) -> None:
    product_id, _, _ = _setup(client, engine)
    outsider = _customer(client, "Beto")

    assert _rule(_sold(client, product_id, outsider, "12")) == ("bulk", 800)


def test_a_member_with_the_switch_off_gets_list(client: TestClient, engine: Engine) -> None:
    product_id, customer_id, _ = _setup(client, engine)
    set_switches(engine, bulk=True, vip=False)

    assert _rule(_sold(client, product_id, customer_id, "5")) == ("list", 1_000)


def test_moving_a_customer_in_or_out_of_the_vip_type_changes_the_rule_from_the_next_sale(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, vip_type = _setup(client, engine)
    other = make_type(engine, "Amigos", is_vip=False)

    first = _sold(client, product_id, customer_id, "5")
    put_in_type(engine, customer_id, other)
    out = _sold(client, product_id, customer_id, "5")
    put_in_type(engine, customer_id, vip_type)
    back = _sold(client, product_id, customer_id, "5")

    assert [_rule(first), _rule(out), _rule(back)] == [
        ("vip", 700),
        ("list", 1_000),
        ("vip", 700),
    ]
    assert _rule(client.get(f"/sales/{first['id']}").json()) == ("vip", 700)


def test_a_type_the_seller_named_vip_gives_nothing(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=True, vip=True)
    product_id = _variety(client)
    seller_made = make_type(engine, "VIP", is_vip=False)
    customer_id = _customer(client)
    put_in_type(engine, customer_id, seller_made)

    assert _rule(_sold(client, product_id, customer_id, "5")) == ("list", 1_000)


def test_the_frozen_vip_column_is_not_read(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=True, vip=True)
    product_id = _variety(client)
    make_type(engine, is_vip=True)
    customer_id = _customer(client)
    with Session(engine) as session:
        session.execute(update(CustomerRow).values(vip=True))
        session.commit()

    sale = _sold(client, product_id, customer_id, "5")

    assert _rule(sale) == ("list", 1_000)
    assert sale["customer"]["vip"] is False


def test_the_sales_list_badge_follows_membership(client: TestClient, engine: Engine) -> None:
    product_id, customer_id, vip_type = _setup(client, engine)
    sale = _sold(client, product_id, customer_id, "5")

    def badge() -> tuple[bool, bool]:
        listed = next(s for s in client.get("/sales").json() if s["id"] == sale["id"])
        return listed["customer"]["vip"], client.get(f"/sales/{sale['id']}").json()["customer"][
            "vip"
        ]

    assert badge() == (True, True)
    put_in_type(engine, customer_id, make_type(engine, "Amigos", is_vip=False))
    assert badge() == (False, False)
    put_in_type(engine, customer_id, vip_type)
    assert badge() == (True, True)


def test_a_business_without_a_vip_type_has_no_vip_badge(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=True, vip=True)
    product_id = _variety(client)
    customer_id = _customer(client)
    put_in_type(engine, customer_id, make_type(engine, "Amigos", is_vip=False))

    sale = _sold(client, product_id, customer_id, "5")

    assert sale["customer"]["vip"] is False
    assert _rule(sale) == ("list", 1_000)
