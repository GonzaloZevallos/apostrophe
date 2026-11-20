"""Every Sale the sales API returns carries `payment_state` and `still_owed`
(CONTEXT.md: Payment state), worked out live from the Settlement. The reference set is
recorded over HTTP only; on the list and on the detail the two fields are compared with
`SqlOwingSales.settlement_of`, the Settlement itself, with 0 differences. The suite opens
each business at both Money scales, so the same rows run at both.
"""

from __future__ import annotations

import logging
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.payments.adapters.settlements import SqlOwingSales
from app.sales.application.ports import CustomerSettlement, OwingSales
from tests.payment_body import payment_body

PRICE = 10_000
DAY = "2026-10-02"


def _variety(client: TestClient, name: str = "Lavanda") -> int:
    variety = client.post("/api/products", json={"name": name}).json()
    priced = client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": PRICE},
    )
    assert priced.status_code == 201, priced.text
    return int(variety["id"])


def _customer(client: TestClient, name: str = "Juana") -> int:
    phone = f"11 {sum(map(ord, name)):04d}-{len(name):04d}"
    response = client.post("/customers", json={"name": name, "phone": phone, "phone_country": "AR"})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _record(
    client: TestClient,
    variety: int,
    payment: str | None,
    customer: int | None,
    *,
    quantity: str = "1",
    on: str = DAY,
    **extra: Any,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "date": on,
        "lines": [{"product_id": variety, "quantity": quantity}],
        **extra,
    }
    if payment is not None:
        body["payment"] = payment_body(payment)
    if customer is not None:
        body["customer_id"] = customer
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    sale: dict[str, Any] = response.json()
    return sale


def _pay(client: TestClient, customer: int, amount: int, on: str = DAY) -> None:
    response = client.post(
        f"/customers/{customer}/payments",
        json={"paid_on": on, "amount": amount, "payment_method_id": 1},
    )
    assert response.status_code == 201, response.text


def _business_id(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text("SELECT min(id) FROM business")).scalar_one())


def _settlement(engine: Engine, customer: int) -> CustomerSettlement:
    with Session(engine) as session:
        return SqlOwingSales(session, _business_id(engine)).settlement_of(customer)


def _list(client: TestClient) -> dict[int, dict[str, Any]]:
    response = client.get("/sales")
    assert response.status_code == 200, response.text
    return {sale["id"]: sale for sale in response.json()}


def _detail(client: TestClient, sale_id: int) -> dict[str, Any]:
    response = client.get(f"/sales/{sale_id}")
    assert response.status_code == 200, response.text
    detail: dict[str, Any] = response.json()
    return detail


@dataclass(frozen=True)
class Expected:
    state: str
    owed: int


def _check(
    client: TestClient,
    engine: Engine,
    expected: Mapping[int, Expected],
    customers: Mapping[int, int],
) -> None:
    """`customers` maps a sale id to its customer id; a sale with none is absent."""
    listed = _list(client)
    for sale_id, want in expected.items():
        detail = _detail(client, sale_id)
        for source in (listed[sale_id], detail):
            assert (source["payment_state"], source["still_owed"]) == (want.state, want.owed)
        customer = customers.get(sale_id)
        settlement = _settlement(engine, customer).still_owed if customer is not None else {}
        # The Settlement is the reference: a sale it lists reads its figure, a paid
        # one it does not list reads 0.
        assert listed[sale_id]["still_owed"] == settlement.get(sale_id, 0)


def test_every_state_matches_the_settlement_on_the_list_and_on_the_detail(
    client: TestClient, engine: Engine
) -> None:
    variety = _variety(client)
    juana = _customer(client, "Juana")
    marta = _customer(client, "Marta")
    spot = _record(client, variety, "cash", juana)["id"]
    spot_alone = _record(client, variety, "cash", None)["id"]
    later = _record(client, variety, "owing", juana, on="2026-10-01")["id"]
    part = _record(client, variety, "owing", juana, quantity="2", on="2026-10-02")["id"]
    unpaid = _record(client, variety, "owing", marta)["id"]
    _pay(client, juana, PRICE + 4_000)

    expected = {
        spot: Expected("paid", 0),
        spot_alone: Expected("paid", 0),
        later: Expected("paid", 0),
        part: Expected("part_paid", 16_000),
        unpaid: Expected("unpaid", PRICE),
    }
    _check(client, engine, expected, {spot: juana, later: juana, part: juana, unpaid: marta})


def test_a_sale_with_a_zero_total_is_paid_and_owes_nothing(
    client: TestClient, engine: Engine
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    body = {
        "customer_id": customer,
        "date": DAY,
        "lines": [{"product_id": variety, "quantity": "1", "gift": True}],
    }
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    sale = response.json()

    assert (sale["total"], sale["payment_state"], sale["still_owed"]) == (0, "paid", 0)
    _check(client, engine, {sale["id"]: Expected("paid", 0)}, {})
    assert _settlement(engine, customer).still_owed.get(sale["id"], 0) == 0


def test_a_sale_settled_by_a_credit_is_paid(client: TestClient, engine: Engine) -> None:
    variety = _variety(client)
    customer = _customer(client)
    first = _record(client, variety, "owing", customer, on="2026-10-01")["id"]
    _pay(client, customer, PRICE)
    assert client.delete(f"/sales/{first}").status_code == 200
    second = _record(client, variety, "owing", customer, on="2026-09-30")["id"]

    assert _settlement(engine, customer).still_owed[second] == 0
    _check(client, engine, {second: Expected("paid", 0)}, {second: customer})


def test_money_with_shipping_a_special_price_and_a_part_payment_with_odd_figures(
    client: TestClient, engine: Engine
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    body: dict[str, Any] = {
        "customer_id": customer,
        "date": DAY,
        "shipping_charged": 1_250,
        "payment": {"kind": "owing"},
        "lines": [
            {"product_id": variety, "quantity": "2.5"},
            {"product_id": variety, "quantity": "0.3", "special_price": 7_777},
        ],
    }
    created = client.post("/sales", json=body)
    assert created.status_code == 201, created.text
    sale = created.json()
    assert (sale["payment_state"], sale["still_owed"]) == ("unpaid", sale["total"])
    _pay(client, customer, 3_333)

    owed = sale["total"] - 3_333
    _check(client, engine, {sale["id"]: Expected("part_paid", owed)}, {sale["id"]: customer})


def test_the_write_routes_return_the_same_values(client: TestClient, engine: Engine) -> None:
    variety = _variety(client)
    customer = _customer(client)
    other = _customer(client, "Marta")
    _record(client, variety, "owing", customer, on="2026-10-01")
    _pay(client, customer, 4_000)
    posted = _record(client, variety, "owing", customer, on="2026-10-02")

    assert (posted["payment_state"], posted["still_owed"]) == ("unpaid", PRICE)
    assert _detail(client, posted["id"])["still_owed"] == PRICE

    no_customer = client.post(
        "/sales",
        json={
            "date": DAY,
            "payment": payment_body("cash"),
            "lines": [{"product_id": variety, "quantity": "1"}],
        },
    ).json()
    assert (no_customer["payment_state"], no_customer["still_owed"]) == ("paid", 0)
    assigned = client.put(f"/sales/{no_customer['id']}/customer", json={"customer_id": other})
    assert assigned.status_code == 200, assigned.text
    assert (assigned.json()["payment_state"], assigned.json()["still_owed"]) == ("paid", 0)
    assert _list(client)[no_customer["id"]]["payment_state"] == "paid"


# --- containment and the trace -----------------------------------------------------------


class BentOwingSales:
    """Wraps the real `SqlOwingSales` and bends what it answers, to make one sale's
    payment facts impossible to reconcile."""

    def __init__(self, real: SqlOwingSales, bend: Mapping[int, int | None]) -> None:
        self._real = real
        self._bend = bend

    def _bent(self, owed: Mapping[int, int]) -> dict[int, int]:
        bent = dict(owed)
        for sale_id, amount in self._bend.items():
            if amount is None:
                bent.pop(sale_id, None)
            else:
                bent[sale_id] = amount
        return bent

    def still_owing(self, customer_ids: Collection[int]) -> frozenset[int]:
        return frozenset(i for i, amount in self.owed_of(customer_ids).items() if amount > 0)

    def owed_of(self, customer_ids: Collection[int]) -> Mapping[int, int]:
        return self._bent(self._real.owed_of(customer_ids))

    def settlement_of(self, customer_id: int) -> CustomerSettlement:
        real = self._real.settlement_of(customer_id)
        return CustomerSettlement(real.balance, self._bent(real.still_owed))


def _bend(app: FastAPI, bend: Mapping[int, int | None]) -> None:
    def factory(session: Session, business_id: int) -> OwingSales:
        return BentOwingSales(SqlOwingSales(session, business_id), bend)

    app.state.owing_sales = factory


def _without_payment_facts(sale: dict[str, Any]) -> dict[str, Any]:
    return {
        k: v
        for k, v in sale.items()
        if k not in ("payment_state", "still_owed", "still_owing", "bill")
    }


@pytest.fixture
def broken(client: TestClient, app: FastAPI) -> dict[str, Any]:
    """A customer with one healthy unpaid sale, one sale the Settlement stops listing
    (rule 4) and one sale paid on the spot that it lists (rule 2)."""
    variety = _variety(client)
    customer = _customer(client, "Marta Quispe")
    healthy = _record(client, variety, "owing", customer, on="2026-10-01", note="secreto")["id"]
    dropped = _record(client, variety, "owing", customer, on="2026-10-02", note="secreto")
    listed_spot = _record(client, variety, "cash", customer, on="2026-09-30", note="secreto")
    before = _list(client)
    _bend(app, {dropped["id"]: None, listed_spot["id"]: 50})
    return {
        "healthy": healthy,
        "dropped": dropped,
        "spot": listed_spot,
        "before": before,
        "customer": customer,
    }


def _unreconciled(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "apostrophe.sales"]


def test_an_inconsistent_sale_is_null_on_the_list_and_every_other_row_is_unchanged(
    client: TestClient, engine: Engine, broken: dict[str, Any], caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="apostrophe.sales")
    business_id = _business_id(engine)

    listed = _list(client)

    for key in ("dropped", "spot"):
        sale = listed[broken[key]["id"]]
        assert (sale["payment_state"], sale["still_owed"]) == (None, None)
        assert _without_payment_facts(sale) == _without_payment_facts(
            broken["before"][broken[key]["id"]]
        )
    healthy = listed[broken["healthy"]]
    assert (healthy["payment_state"], healthy["still_owed"]) == ("unpaid", PRICE)
    assert sorted(r.args or () for r in _unreconciled(caplog)) == sorted(
        [
            (business_id, broken["dropped"]["number"]),
            (business_id, broken["spot"]["number"]),
        ]
    )


def test_the_detail_of_an_inconsistent_sale_is_null_with_no_bill_and_logs_once(
    client: TestClient, engine: Engine, broken: dict[str, Any], caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="apostrophe.sales")
    sale = broken["dropped"]

    detail = _detail(client, sale["id"])

    assert (detail["payment_state"], detail["still_owed"], detail["bill"]) == (None, None, None)
    assert _without_payment_facts(detail)["id"] == sale["id"]
    assert [r.args for r in _unreconciled(caplog)] == [(_business_id(engine), sale["number"])]
    healthy = _detail(client, broken["healthy"])
    assert (healthy["payment_state"], healthy["still_owed"]) == ("unpaid", PRICE)
    assert healthy["bill"] is not None


def test_assigning_a_customer_to_an_inconsistent_sale_still_answers(
    client: TestClient, engine: Engine, app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="apostrophe.sales")
    variety = _variety(client)
    customer = _customer(client)
    sale = _record(client, variety, "cash", None)
    _bend(app, {sale["id"]: 50})

    response = client.put(f"/sales/{sale['id']}/customer", json={"customer_id": customer})

    assert response.status_code == 200, response.text
    assert (response.json()["payment_state"], response.json()["still_owed"]) == (None, None)
    assert [r.args for r in _unreconciled(caplog)] == [(_business_id(engine), sale["number"])]


def test_recording_a_sale_the_settlement_does_not_list_still_answers_201(
    client: TestClient, engine: Engine, app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="apostrophe.sales")
    variety = _variety(client)
    customer = _customer(client)

    class DropsEverything:
        def __init__(self, real: SqlOwingSales) -> None:
            self._real = real

        def still_owing(self, customer_ids: Collection[int]) -> frozenset[int]:
            return frozenset()

        def owed_of(self, customer_ids: Collection[int]) -> Mapping[int, int]:
            return {}

        def settlement_of(self, customer_id: int) -> CustomerSettlement:
            return CustomerSettlement(0, {})

    def factory(session: Session, business_id: int) -> OwingSales:
        return DropsEverything(SqlOwingSales(session, business_id))

    app.state.owing_sales = factory
    created = _record(client, variety, "owing", customer)

    assert (created["payment_state"], created["still_owed"]) == (None, None)
    assert [r.args for r in _unreconciled(caplog)] == [(_business_id(engine), created["number"])]


def test_the_log_line_holds_the_business_and_the_sale_number_and_nothing_else(
    client: TestClient, engine: Engine, broken: dict[str, Any], caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    sale = broken["dropped"]

    _detail(client, sale["id"])

    (record,) = _unreconciled(caplog)
    assert record.levelno == logging.WARNING
    assert record.exc_info is None
    assert record.args == (_business_id(engine), sale["number"])
    message = record.getMessage()
    for private in ("secreto", "Marta", "Quispe", str(sale["total"]), str(PRICE)):
        assert private not in message
    assert message.count(str(sale["number"])) >= 1
