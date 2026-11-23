"""Payments' own routes (plan, "Contract"): preview and record a later payment, a
customer's account, deleting one, and who owes across the business — through
`TestClient`, the real adapters and `settle()`/`account_of()` underneath.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.payments.adapters.tables import PaymentRow
from tests.conftest import NOW, MovableClock
from tests.contract_shapes import assert_matches_fixture

TODAY = "2026-10-02"  # tests/conftest.py's own TODAY


def _priced_variety(client: TestClient, *, price: int = 1_000, name: str = "Variety") -> int:
    variety: dict[str, int] = client.post("/api/products", json={"name": name}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": price},
    )
    return variety["id"]


def _customer(client: TestClient, name: str = "Customer", phone: str = "11 2000-0000") -> int:
    body: dict[str, int] = client.post(
        "/customers", json={"name": name, "phone": phone, "phone_country": "AR"}
    ).json()
    return body["id"]


def _owing_sale(
    client: TestClient, customer_id: int, variety_id: int, *, quantity: str = "10", sale_date: str
) -> int:
    body = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "owing"},
            "date": sale_date,
            "lines": [{"product_id": variety_id, "quantity": quantity}],
        },
    )
    assert body.status_code == 201, body.text
    result: int = body.json()["id"]
    return result


# -- fixture matches ------------------------------------------------------------------


def test_preview_matches_its_fixture(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=11_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-14")

    response = client.post(
        f"/customers/{customer_id}/payments/preview",
        json={"paid_on": "2026-09-20", "amount": 5_000},
    )

    assert response.status_code == 200, response.text
    assert_matches_fixture(response.json(), "payment-preview")


def test_record_matches_its_fixture(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=11_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-14")

    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": 5_000, "payment_method_id": 1},
    )

    assert response.status_code == 201, response.text
    assert_matches_fixture(response.json(), "payment")


def test_account_matches_its_fixture(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=11_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-14")
    client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": 5_000, "payment_method_id": 1},
    )

    response = client.get(f"/customers/{customer_id}/account")

    assert response.status_code == 200, response.text
    assert_matches_fixture(response.json(), "account")


def test_debtors_matches_its_fixture(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=11_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-14")

    response = client.get("/payments/debtors")

    assert response.status_code == 200, response.text
    assert_matches_fixture(response.json(), "debtors")


# -- refusals, each with its own code and no amount or name leaked -------------------


def test_above_balance_is_refused_on_preview_and_record_with_nothing_leaked(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client, name="Secret Name")
    _owing_sale(client, customer_id, variety_id, quantity="1", sale_date="2026-09-01")

    preview = client.post(
        f"/customers/{customer_id}/payments/preview",
        json={"paid_on": TODAY, "amount": 999_999},
    )
    record = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY, "amount": 999_999, "payment_method_id": 1},
    )

    for response in (preview, record):
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "payment.above_balance"
        assert "999999" not in response.text
        assert "Secret Name" not in response.text


def test_future_date_is_refused(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-01")

    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-12-25", "amount": 1, "payment_method_id": 1},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "payment.future_date"


def test_a_non_positive_amount_is_refused(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-01")

    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY, "amount": 0, "payment_method_id": 1},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "payment.amount_invalid"


def test_a_missing_method_is_refused_only_on_record_not_preview(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-01")

    preview = client.post(
        f"/customers/{customer_id}/payments/preview",
        json={"paid_on": TODAY, "amount": 1},
    )
    record = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY, "amount": 1, "payment_method_id": None},
    )

    assert preview.status_code == 200, preview.text
    assert record.status_code == 422, record.text
    assert record.json()["code"] == "payment.method_required"


def test_a_missing_customer_is_404_on_preview_record_and_account(client: TestClient) -> None:
    for response in (
        client.post("/customers/999999/payments/preview", json={"paid_on": TODAY, "amount": 1}),
        client.post(
            "/customers/999999/payments",
            json={"paid_on": TODAY, "amount": 1, "payment_method_id": 1},
        ),
        client.get("/customers/999999/account"),
    ):
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "payment.customer_not_found"


def test_deleting_a_missing_payment_is_404(client: TestClient) -> None:
    response = client.delete("/payments/999999")

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "payment.not_found"


def test_deleting_an_on_the_spot_payment_is_refused(client: TestClient, engine: Engine) -> None:
    variety_id = _priced_variety(client)
    sale = client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": 1},
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    ).json()
    with Session(engine) as session:
        payment_id = session.scalar(select(PaymentRow.id).where(PaymentRow.sale_id == sale["id"]))
    assert payment_id is not None

    response = client.delete(f"/payments/{payment_id}")

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "payment.on_the_spot"


# -- settlement behaviour through the routes -----------------------------------------


def test_a_cash_sale_s_payment_never_settles_an_owed_sale(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, quantity="1", sale_date="2026-09-01")
    cash_sale = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "paid", "payment_method_id": 1},
            "date": "2026-09-10",
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    )
    assert cash_sale.status_code == 201, cash_sale.text

    account = client.get(f"/customers/{customer_id}/account").json()

    assert account["balance"] == 1_000
    assert account["owing_since"] == "2026-09-01"


def test_preview_answers_exactly_what_recording_would_settle(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, quantity="10", sale_date="2026-09-01")

    preview = client.post(
        f"/customers/{customer_id}/payments/preview",
        json={"paid_on": "2026-09-20", "amount": 4_000},
    )
    recorded = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": 4_000, "payment_method_id": 1},
    )

    assert preview.status_code == 200, preview.text
    assert recorded.status_code == 201, recorded.text
    assert preview.json()["applied_to"] == recorded.json()["applied_to"]
    assert preview.json()["after"] == recorded.json()["after"]


def test_debtors_tie_order_matches_customers_sort_order(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=1_000)
    names = ["Zoe", "Ángela", "beto", "Beto"]
    ids = []
    for index, name in enumerate(names):
        customer_id = _customer(client, name=name, phone=f"11 300{index}-000{index}")
        ids.append(customer_id)
        _owing_sale(client, customer_id, variety_id, quantity="1", sale_date="2026-09-01")

    debtors = client.get("/payments/debtors").json()["debtors"]
    debtor_names = [d["customer"]["name"] for d in debtors if d["customer"]["id"] in ids]

    customers = client.get("/customers").json()
    customers_names = [c["name"] for c in customers if c["id"] in ids]

    assert debtor_names == customers_names


def test_a_payment_s_fields_are_unchanged_after_a_sale_is_later_deleted(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, quantity="10", sale_date="2026-09-01")
    sale2 = _owing_sale(client, customer_id, variety_id, quantity="5", sale_date="2026-09-10")

    recorded = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-15", "amount": 3_000, "payment_method_id": 2},
    )
    assert recorded.status_code == 201, recorded.text
    payment = recorded.json()["payment"]

    deleted = client.delete(f"/sales/{sale2}")
    assert deleted.status_code == 200, deleted.text

    account = client.get(f"/customers/{customer_id}/account").json()
    [row] = [
        row
        for row in account["rows"]
        if row["kind"] == "payment" and row["payment"]["id"] == payment["id"]
    ]

    shown = dict(row["payment"])
    assert shown.pop("payment_method")["id"] == payment.pop("payment_method_id")
    assert shown == payment


# -- the account as a ledger walk -------------------------------------------------------


def _account(client: TestClient, customer_id: int) -> dict[str, Any]:
    response = client.get(f"/customers/{customer_id}/account")
    assert response.status_code == 200, response.text
    account: dict[str, Any] = response.json()
    assert account["rows"][-1]["running_balance"] == account["balance"]
    return account


def _kinds(account: dict[str, Any]) -> list[str]:
    return [row["kind"] for row in account["rows"]]


def test_a_payment_of_an_older_debt_recorded_before_a_same_day_sale_comes_first(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, quantity="10", sale_date="2026-09-01")
    clock.set(NOW + timedelta(hours=1))
    paid = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-10", "amount": 4_000, "payment_method_id": 1},
    )
    assert paid.status_code == 201, paid.text
    clock.set(NOW + timedelta(hours=2))
    _owing_sale(client, customer_id, variety_id, quantity="5", sale_date="2026-09-10")

    account = _account(client, customer_id)

    assert _kinds(account) == ["sale", "payment", "sale"]
    assert [row["running_balance"] for row in account["rows"]] == [10_000, 6_000, 11_000]
    assert account["rows"][1]["is_partial"] is True
    assert "applied_to" not in account["rows"][1]
    assert "number" in account["rows"][0]


def test_a_payment_recorded_after_a_same_day_sale_puts_the_sale_first(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, quantity="10", sale_date="2026-09-01")
    clock.set(NOW + timedelta(hours=1))
    _owing_sale(client, customer_id, variety_id, quantity="5", sale_date="2026-09-10")
    clock.set(NOW + timedelta(hours=2))
    paid = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-10", "amount": 4_000, "payment_method_id": 1},
    )
    assert paid.status_code == 201, paid.text

    account = _account(client, customer_id)

    assert _kinds(account) == ["sale", "sale", "payment"]
    assert [row["running_balance"] for row in account["rows"]] == [10_000, 15_000, 11_000]


def test_a_sale_assigned_a_customer_later_keeps_its_place_in_the_account(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _priced_variety(client, price=1_000)
    customer_id = _customer(client)
    anonymous = client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": 1},
            "date": "2026-09-10",
            "lines": [{"product_id": variety_id, "quantity": "5"}],
        },
    )
    assert anonymous.status_code == 201, anonymous.text
    clock.set(NOW + timedelta(hours=1))
    _owing_sale(client, customer_id, variety_id, quantity="10", sale_date="2026-09-10")
    clock.set(NOW + timedelta(hours=2))
    assigned = client.put(
        f"/sales/{anonymous.json()['id']}/customer", json={"customer_id": customer_id}
    )
    assert assigned.status_code == 200, assigned.text

    account = _account(client, customer_id)

    assert [row["sale"]["id"] for row in account["rows"]] == [anonymous.json()["id"], 2]
    assert [row["running_balance"] for row in account["rows"]] == [0, 10_000]
