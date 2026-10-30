"""Payments' own routes (plan, "Contract"): preview and record a later payment, a
customer's account, deleting one, and who owes across the business — through
`TestClient`, the real adapters and `settle()`/`account_of()` underneath.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.payments.adapters.tables import PaymentRow
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
    body: dict[str, int] = client.post("/customers", json={"name": name, "phone": phone}).json()
    return body["id"]


def _owing_sale(
    client: TestClient, customer_id: int, variety_id: int, *, quantity: str = "10", sale_date: str
) -> int:
    body = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
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
        json={"paid_on": "2026-09-20", "amount": 5_000, "method": "cash"},
    )

    assert response.status_code == 201, response.text
    assert_matches_fixture(response.json(), "payment")


def test_account_matches_its_fixture(client: TestClient) -> None:
    variety_id = _priced_variety(client, price=11_000)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-14")
    client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": 5_000, "method": "cash"},
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
        json={"paid_on": TODAY, "amount": 999_999, "method": "cash"},
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
        json={"paid_on": "2026-12-25", "amount": 1, "method": "cash"},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "payment.future_date"


def test_a_non_positive_amount_is_refused(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    customer_id = _customer(client)
    _owing_sale(client, customer_id, variety_id, sale_date="2026-09-01")

    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY, "amount": 0, "method": "cash"},
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
        json={"paid_on": TODAY, "amount": 1, "method": None},
    )

    assert preview.status_code == 200, preview.text
    assert record.status_code == 422, record.text
    assert record.json()["code"] == "payment.method_required"


def test_a_missing_customer_is_404_on_preview_record_and_account(client: TestClient) -> None:
    for response in (
        client.post("/customers/999999/payments/preview", json={"paid_on": TODAY, "amount": 1}),
        client.post(
            "/customers/999999/payments",
            json={"paid_on": TODAY, "amount": 1, "method": "cash"},
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
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "1"}]},
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
            "payment": "cash",
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
        json={"paid_on": "2026-09-20", "amount": 4_000, "method": "cash"},
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
        json={"paid_on": "2026-09-15", "amount": 3_000, "method": "transfer"},
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

    assert row["payment"] == payment
