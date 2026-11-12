"""A sale line priced by the customer's type (docs/adr/0059), at the HTTP seam over a real
database. Entry A (from 2026-01-01): list 1000, bulk 800 from 10, the VIP type's price 700
on its row. Entry B (from 2026-03-01): list 1000 and no type price, so from B's date the
type's customers pay list or bulk again. A type line records the rule `type`, the type id
and a copy of its name, once, and nothing later changes it."""

import itertools
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import delete, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypePriceRow, CustomerTypeRow
from app.customers.adapters.tables import CustomerRow
from tests.payment_body import payment_body
from tests.pricing_switches import set_switches
from tests.vip_type import make_type, price_type, put_in_type

_phones = itertools.count(2000)


def _entry(client: TestClient, product_id: int, day: str, *, bulk: bool) -> None:
    entry: dict[str, object] = {"effective_from": day, "list_price": 1_000}
    if bulk:
        entry.update(bulk_price=800, bulk_minimum="10")
    created = client.post(f"/api/products/{product_id}/prices", json=entry)
    assert created.status_code == 201, created.text


def _customer(client: TestClient, name: str = "Juana") -> int:
    body = {"name": name, "phone": f"11 {next(_phones)}-0000", "phone_country": "AR"}
    return int(client.post("/customers", json=body).json()["id"])


def _sell(
    client: TestClient, product_id: int, customer_id: int | None, day: str, quantity: str = "5"
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "date": day,
        "payment": payment_body("cash", client),
        "lines": [{"product_id": product_id, "quantity": quantity}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    created = client.post("/sales", json=body)
    assert created.status_code == 201, created.text
    sale: dict[str, Any] = created.json()
    return sale


def _line(sale: dict[str, Any]) -> tuple[str, int, str | None]:
    line = sale["lines"][0]
    return line["pricing_rule"], line["price_per_gram"], line["customer_type_name"]


def _setup(client: TestClient, engine: Engine) -> tuple[int, int, int]:
    """(product, customer in the VIP type, the VIP type) with entry A priced for the type."""
    set_switches(engine, bulk=True, vip=True)
    product_id = int(client.post("/api/products", json={"name": "Lavanda"}).json()["id"])
    _entry(client, product_id, "2026-01-01", bulk=True)
    vip_type = make_type(engine, "Mayoristas", is_vip=True)
    price_type(engine, product_id, vip_type, 700)
    customer_id = _customer(client)
    put_in_type(engine, customer_id, vip_type)
    return product_id, customer_id, vip_type


def test_a_sale_for_a_vip_type_customer_records_the_type_and_a_copy_of_its_name(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine)

    sale = _sell(client, product_id, customer_id, "2026-02-01")

    assert _line(sale) == ("type", 700, "Mayoristas")
    assert _line(client.get(f"/sales/{sale['id']}").json()) == ("type", 700, "Mayoristas")


def test_a_later_entry_without_a_type_price_ends_it_from_its_own_date(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine)
    _entry(client, product_id, "2026-03-01", bulk=False)

    before = _sell(client, product_id, customer_id, "2026-02-28")
    after = _sell(client, product_id, customer_id, "2026-03-05")
    after_at_bulk = _sell(client, product_id, customer_id, "2026-03-05", "12")

    assert _line(before) == ("type", 700, "Mayoristas")
    assert _line(after) == ("list", 1_000, None)
    assert _line(after_at_bulk) == ("list", 1_000, None)


def test_a_recorded_line_survives_a_rename_a_move_the_switch_and_the_types_deletion(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine)
    sale = _sell(client, product_id, customer_id, "2026-02-01")
    recorded = ("type", 700, "Mayoristas")

    with Session(engine) as session:
        session.execute(update(CustomerTypeRow).values(name="Otro nombre", name_key="otro"))
        session.commit()
    assert _line(client.get(f"/sales/{sale['id']}").json()) == recorded

    put_in_type(engine, customer_id, make_type(engine, "Amigos", is_vip=False))
    set_switches(engine, bulk=True, vip=False)
    assert _line(client.get(f"/sales/{sale['id']}").json()) == recorded

    with Session(engine) as session:
        session.execute(update(CustomerRow).values(customer_type_id=None))
        session.execute(delete(CustomerTypePriceRow))
        session.execute(delete(CustomerTypeRow))
        session.commit()
    assert _line(client.get(f"/sales/{sale['id']}").json()) == recorded
    assert _line(client.get("/sales").json()[0]) == recorded


def test_assigning_a_customer_to_a_sale_without_one_does_not_reprice_it(
    client: TestClient, engine: Engine
) -> None:
    product_id, customer_id, _ = _setup(client, engine)
    sale = _sell(client, product_id, None, "2026-02-01")
    assert _line(sale) == ("list", 1_000, None)

    assigned = client.put(f"/sales/{sale['id']}/customer", json={"customer_id": customer_id})

    assert assigned.status_code == 200, assigned.text
    assert _line(client.get(f"/sales/{sale['id']}").json()) == ("list", 1_000, None)
