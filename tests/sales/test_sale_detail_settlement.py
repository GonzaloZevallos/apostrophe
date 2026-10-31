"""`GET /sales/{id}` reads settlement once, through `OwingSales.settlement_of`, and its
`still_owing` comes from that one read (the plan's invariant 1). A delegating spy over
the real `SqlOwingSales` counts the calls; it is not a stub. The adapter's own answer
is checked on rows recorded over HTTP.
"""

from __future__ import annotations

from collections.abc import Collection, MutableMapping
from datetime import date
from typing import cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payments.adapters.settlements import SqlOwingSales
from app.sales.application.ports import CustomerSettlement, OwingSales

TODAY = date(2026, 6, 15)


class SpyOwingSales:
    """Wraps the real `SqlOwingSales`, counting each call."""

    def __init__(self, real: SqlOwingSales, calls: dict[str, int]) -> None:
        self._real = real
        self._calls = calls

    def still_owing(self, customer_ids: Collection[int]) -> frozenset[int]:
        self._calls["still_owing"] += 1
        return self._real.still_owing(customer_ids)

    def settlement_of(self, customer_id: int) -> CustomerSettlement:
        self._calls["settlement_of"] += 1
        return self._real.settlement_of(customer_id)


@pytest.fixture
def calls(app: FastAPI) -> dict[str, int]:
    counts = {"still_owing": 0, "settlement_of": 0}

    def factory(session: Session, business_id: int) -> OwingSales:
        return SpyOwingSales(SqlOwingSales(session, business_id), counts)

    app.state.owing_sales = factory
    return counts


def _variety(client: TestClient) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(variety["id"])


def _customer(client: TestClient, name: str = "Juana") -> int:
    # The phone is unique per customer: a repeated one is refused.
    phone = f"11 {sum(map(ord, name)):04d}-{len(name):04d}"
    response = client.post("/customers", json={"name": name, "phone": phone})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _sale(client: TestClient, variety_id: int, payment: str, customer_id: int | None) -> int:
    body: dict[str, object] = {
        "payment": payment,
        "lines": [{"product_id": variety_id, "quantity": "1"}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _pay(client: TestClient, customer_id: int, amount: int) -> None:
    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY.isoformat(), "amount": amount, "method": "cash"},
    )
    assert response.status_code == 201, response.text


def test_a_customers_sale_detail_makes_one_settlement_read_and_no_batched_one(
    client: TestClient, calls: dict[str, int]
) -> None:
    sale_id = _sale(client, _variety(client), "owing", _customer(client))
    calls.update(still_owing=0, settlement_of=0)

    assert client.get(f"/sales/{sale_id}").status_code == 200

    assert calls == {"still_owing": 0, "settlement_of": 1}


def test_a_sale_without_a_customer_makes_no_settlement_read(
    client: TestClient, calls: dict[str, int]
) -> None:
    sale_id = _sale(client, _variety(client), "cash", None)
    calls.update(still_owing=0, settlement_of=0)

    assert client.get(f"/sales/{sale_id}").status_code == 200

    assert calls == {"still_owing": 0, "settlement_of": 0}


def test_another_businesss_sale_is_a_404_before_any_settlement_read(
    client: TestClient, other_client: TestClient, calls: dict[str, int]
) -> None:
    sale_id = _sale(client, _variety(client), "owing", _customer(client))
    calls.update(still_owing=0, settlement_of=0)

    assert other_client.get(f"/sales/{sale_id}").status_code == 404

    assert calls == {"still_owing": 0, "settlement_of": 0}


def test_still_owing_on_the_detail_follows_settlement(client: TestClient) -> None:
    variety_id = _variety(client)
    owed = _customer(client, "Owed")
    owed_sale = _sale(client, variety_id, "owing", owed)

    partly = _customer(client, "Partly")
    partly_sale = _sale(client, variety_id, "owing", partly)
    _pay(client, partly, 4_000)

    later = _customer(client, "Later")
    later_sale = _sale(client, variety_id, "owing", later)
    _pay(client, later, 10_000)

    spot = _customer(client, "Spot")
    spot_sale = _sale(client, variety_id, "cash", spot)
    none_sale = _sale(client, variety_id, "cash", None)

    def still_owing(sale_id: int) -> bool:
        return bool(client.get(f"/sales/{sale_id}").json()["still_owing"])

    assert still_owing(owed_sale) is True
    assert still_owing(partly_sale) is True
    assert still_owing(later_sale) is False
    assert still_owing(spot_sale) is False
    assert still_owing(none_sale) is False


def _owing_sales_for(engine: Engine, customer_id: int) -> SqlOwingSales:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        business_id = row.business_id
    return SqlOwingSales(Session(engine), business_id)


def test_settlement_of_lists_the_sales_not_paid_on_the_spot_and_the_balance(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety(client)
    customer = _customer(client)
    first = _sale(client, variety_id, "owing", customer)
    second = _sale(client, variety_id, "owing", customer)
    _sale(client, variety_id, "cash", customer)
    _pay(client, customer, 10_000)

    settlement = _owing_sales_for(engine, customer).settlement_of(customer)

    # The payment settles the oldest debt first; the cash sale is not in settlement.
    assert dict(settlement.still_owed) == {first: 0, second: 10_000}
    assert settlement.balance == client.get(f"/customers/{customer}").json()["balance"] == 10_000


def test_settlement_of_a_customer_with_no_sales_is_empty(
    client: TestClient, engine: Engine
) -> None:
    customer = _customer(client)

    settlement = _owing_sales_for(engine, customer).settlement_of(customer)

    assert settlement.balance == 0
    assert dict(settlement.still_owed) == {}


def test_the_settlement_mapping_is_a_copy_and_cannot_be_mutated() -> None:
    source = {1: 5}
    settlement = CustomerSettlement(balance=5, still_owed=source)
    source[2] = 9

    assert dict(settlement.still_owed) == {1: 5}
    with pytest.raises(TypeError):
        cast(MutableMapping[int, int], settlement.still_owed)[3] = 1
