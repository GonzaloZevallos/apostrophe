"""`GET /sales/{id}`'s `bill` through `TestClient` with the real `settle()` (the same
valid rows as the domain table), plus the leak, rename and forced-mismatch cases. The
delegating spy over the real `SqlOwingSales` is the only stand-in. Case 3 (no customer,
not paid on the spot, total above $0) has no HTTP test: `record_sale` refuses to store
such a sale; the use-case test covers it.
"""

from __future__ import annotations

from collections.abc import Callable, Collection
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.payments.adapters.settlements import SqlOwingSales
from app.sales.application.ports import CustomerSettlement, OwingSales
from tests.conftest import TODAY
from tests.pricing_switches import set_switches

PRICE = 10_000
BILL_KEYS = {"business_name", "date", "shipping_charged", "total", "lines", "payment", "balance"}
LINE_KEYS = {"product", "quantity", "amount", "rule", "unit_price"}
PAYMENT_KEYS = {"state", "still_owed"}


def _variety(client: TestClient, name: str = "Lavanda", **prices: int | str) -> int:
    variety = client.post("/varieties", json={"name": name}).json()
    response = client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": PRICE, **prices},
    )
    assert response.status_code == 201, response.text
    return int(variety["id"])


_phones = iter(range(1000, 9999))


def _customer(client: TestClient, name: str = "Juana", vip: bool = False) -> int:
    response = client.post(
        "/customers", json={"name": name, "phone": f"11 {next(_phones)}-0000", "vip": vip}
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _sale(
    client: TestClient,
    variety_id: int,
    payment: str | None,
    customer_id: int | None,
    *,
    gift: bool = False,
) -> int:
    body: dict[str, Any] = {"lines": [{"variety_id": variety_id, "quantity": "1", "gift": gift}]}
    if payment is not None:
        body["payment"] = payment
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


def _detail(client: TestClient, sale_id: int) -> dict[str, Any]:
    response = client.get(f"/sales/{sale_id}")
    assert response.status_code == 200, response.text
    return dict(response.json())


# Each scenario records its sales and answers the id of the one whose bill is read.
Scenario = Callable[[TestClient, int], int]


def _gifts_no_customer(client: TestClient, v: int) -> int:
    return _sale(client, v, None, None, gift=True)


def _gifts_customer_even(client: TestClient, v: int) -> int:
    return _sale(client, v, None, _customer(client), gift=True)


def _gifts_customer_owes(client: TestClient, v: int) -> int:
    customer = _customer(client)
    _sale(client, v, "owing", customer)
    return _sale(client, v, None, customer, gift=True)


def _cash(client: TestClient, v: int) -> int:
    return _sale(client, v, "cash", None)


def _transfer(client: TestClient, v: int) -> int:
    return _sale(client, v, "transfer", _customer(client))


def _cash_owes_elsewhere(client: TestClient, v: int) -> int:
    customer = _customer(client)
    _sale(client, v, "owing", customer)
    return _sale(client, v, "cash", customer)


def _fully_owed(client: TestClient, v: int) -> int:
    return _sale(client, v, "owing", _customer(client))


def _partly_owed(client: TestClient, v: int) -> int:
    customer = _customer(client)
    sale = _sale(client, v, "owing", customer)
    _pay(client, customer, 4_000)
    return sale


def _paid_later(client: TestClient, v: int) -> int:
    customer = _customer(client)
    sale = _sale(client, v, "owing", customer)
    _pay(client, customer, PRICE)
    return sale


def _paid_by_credit(client: TestClient, v: int) -> int:
    # A settled sale is deleted, leaving its payment as a credit that pays the next sale.
    customer = _customer(client)
    first = _sale(client, v, "owing", customer)
    _pay(client, customer, PRICE)
    assert client.delete(f"/sales/{first}").status_code == 200
    return _sale(client, v, "owing", customer)


def _credit_balance(client: TestClient, v: int) -> int:
    # Deleting a settled sale leaves its payment as a credit the customer holds.
    customer = _customer(client)
    settled = _sale(client, v, "owing", customer)
    _pay(client, customer, PRICE)
    assert client.delete(f"/sales/{settled}").status_code == 200
    return _sale(client, v, "cash", customer)


# (scenario, state, still_owed, balance)
ROWS = [
    pytest.param(_gifts_no_customer, "none", None, None, id="gifts-no-customer"),
    pytest.param(_gifts_customer_even, "none", None, None, id="gifts-customer-even"),
    pytest.param(_gifts_customer_owes, "none", None, PRICE, id="gifts-customer-owes"),
    pytest.param(_cash, "cash", None, None, id="cash"),
    pytest.param(_transfer, "transfer", None, None, id="transfer"),
    pytest.param(_cash_owes_elsewhere, "cash", None, PRICE, id="cash-owes-elsewhere"),
    pytest.param(_fully_owed, "owed", PRICE, PRICE, id="fully-owed"),
    pytest.param(_partly_owed, "owed", 6_000, 6_000, id="partly-owed"),
    pytest.param(_paid_later, "paid", None, None, id="paid-by-later-payment"),
    pytest.param(_paid_by_credit, "paid", None, None, id="paid-by-credit"),
    pytest.param(_credit_balance, "cash", None, -PRICE, id="credit-balance"),
]


@pytest.mark.parametrize(("scenario", "state", "still_owed", "balance"), ROWS)
def test_the_state_table_through_the_api(
    client: TestClient,
    scenario: Scenario,
    state: str,
    still_owed: int | None,
    balance: int | None,
) -> None:
    sale_id = scenario(client, _variety(client))

    bill = _detail(client, sale_id)["bill"]

    assert bill["payment"] == {"state": state, "still_owed": still_owed}
    assert bill["balance"] == balance


def test_a_bulk_line_carries_its_rule_and_unit_price_and_a_gift_its_rule_and_no_amount(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=False)
    bulk = _variety(client, "Lavanda", bulk_price=8_000, bulk_minimum="50")
    plain = _variety(client, "Romero")
    response = client.post(
        "/sales",
        json={
            "payment": "cash",
            "shipping_charged": 700,
            "lines": [
                {"variety_id": plain, "quantity": "1.25"},
                {"variety_id": bulk, "quantity": "60"},
                {"variety_id": plain, "quantity": "2", "gift": True},
            ],
        },
    )
    assert response.status_code == 201, response.text

    bill = _detail(client, response.json()["id"])["bill"]

    assert bill["business_name"] == "Primer Negocio"
    assert bill["date"] == TODAY.isoformat()
    assert bill["shipping_charged"] == 700
    assert bill["total"] == 12_500 + 480_000 + 700
    assert bill["lines"] == [
        {"product": "Romero", "quantity": 1.25, "amount": 12_500, "rule": None, "unit_price": None},
        {
            "product": "Lavanda",
            "quantity": 60.0,
            "amount": 480_000,
            "rule": "bulk",
            "unit_price": 8_000,
        },
        {"product": "Romero", "quantity": 2.0, "amount": 0, "rule": "gift", "unit_price": None},
    ]


def _strings(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v)]
    return []


def test_the_bill_leaks_nothing_internal(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=False, vip=True)
    flowers = _variety(client, "Lavanda", vip_price=9_000)
    customer = _customer(client, "Marta Quispe", vip=True)
    note = "nota privada zzz"
    response = client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer,
            "note": note,
            "shipping_charged": 300,
            "lines": [
                {"variety_id": flowers, "quantity": "1"},
                {"variety_id": flowers, "quantity": "2", "special_price": 5_000},
            ],
        },
    )
    assert response.status_code == 201, response.text
    sale_id = response.json()["id"]
    detail = _detail(client, sale_id)
    assert [line["pricing_rule"] for line in detail["lines"]] == ["vip", "special"]
    assert detail["lines"][0]["cost"]["costed"] is None  # pending cost, never in the bill

    bill = detail["bill"]

    assert set(bill) == BILL_KEYS
    assert all(set(line) == LINE_KEYS for line in bill["lines"])
    assert set(bill["payment"]) == PAYMENT_KEYS
    assert [line["rule"] for line in bill["lines"]] == [None, None]
    strings = _strings(bill)
    assert not {"vip", "special", "list"} & set(strings)
    assert note not in strings
    assert "Marta Quispe" not in strings
    numbers = [bill["total"], bill["balance"], bill["shipping_charged"]]
    assert customer not in numbers
    assert sale_id not in numbers
    rendered = repr(bill)
    for word in ("zzz", "Marta", "Quispe", "cost", "margin", "http", "vip", "special"):
        assert word not in rendered


def test_a_rename_shows_on_the_next_read(client: TestClient) -> None:
    sale_id = _sale(client, _variety(client), "cash", None)
    assert _detail(client, sale_id)["bill"]["business_name"] == "Primer Negocio"

    assert client.patch("/business", json={"name": "Flores Nuevas"}).status_code == 200

    assert _detail(client, sale_id)["bill"]["business_name"] == "Flores Nuevas"


class SpyOwingSales:
    """Wraps the real `SqlOwingSales` and bends its settlement of one sale."""

    def __init__(self, real: SqlOwingSales, bend: Callable[[CustomerSettlement], dict[int, int]]):
        self._real = real
        self._bend = bend

    def still_owing(self, customer_ids: Collection[int]) -> frozenset[int]:
        return self._real.still_owing(customer_ids)

    def settlement_of(self, customer_id: int) -> CustomerSettlement:
        real = self._real.settlement_of(customer_id)
        return CustomerSettlement(real.balance, self._bend(real))


def _spy(app: FastAPI, bend: Callable[[CustomerSettlement], dict[int, int]]) -> None:
    def factory(session: Session, business_id: int) -> OwingSales:
        return SpyOwingSales(SqlOwingSales(session, business_id), bend)

    app.state.owing_sales = factory


def _without_bill_and_owing(detail: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in detail.items() if k not in ("bill", "still_owing")}


def test_a_sale_dropped_from_settlement_answers_200_with_no_bill_and_the_rest_unchanged(
    client: TestClient, app: FastAPI
) -> None:
    customer = _customer(client)
    v = _variety(client)
    sale_id = _sale(client, v, "owing", customer)
    _pay(client, customer, PRICE)
    plain = _detail(client, sale_id)
    assert plain["bill"] is not None

    _spy(app, lambda real: {k: x for k, x in real.still_owed.items() if k != sale_id})
    spied = _detail(client, sale_id)

    assert spied["bill"] is None
    assert spied["still_owing"] is False
    assert _without_bill_and_owing(spied) == _without_bill_and_owing(plain)


def test_a_cash_sale_reported_as_owed_answers_200_with_no_bill_and_the_rest_unchanged(
    client: TestClient, app: FastAPI
) -> None:
    sale_id = _sale(client, _variety(client), "cash", _customer(client))
    plain = _detail(client, sale_id)
    assert plain["bill"] is not None

    _spy(app, lambda real: {**real.still_owed, sale_id: 50})
    spied = _detail(client, sale_id)

    assert spied["bill"] is None
    assert spied["still_owing"] is True
    assert _without_bill_and_owing(spied) == _without_bill_and_owing(plain)
