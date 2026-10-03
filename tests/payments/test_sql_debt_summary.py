"""`SqlDebtSummary`, results' `DebtSummary` port (CODING_STANDARDS section 5: adapter
test over real SQLite): `view_accounts.debtors()` unchanged, mapped to results' own
`Debts`/`DebtorRow`, checked against `GET /payments/debtors` over a seed with a debtor,
a credit customer and a settled customer.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payments.adapters.results_ports import SqlDebtSummary


def _priced_variety(client: TestClient, *, price: int = 1_000) -> int:
    variety: dict[str, int] = client.post("/varieties", json={"name": "Variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": price},
    )
    return variety["id"]


def _customer(client: TestClient, name: str, phone: str) -> int:
    body: dict[str, int] = client.post(
        "/customers", json={"name": name, "phone": phone}
    ).json()
    return body["id"]


def _business_id_of_customer(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        return row.business_id


def test_read_matches_get_payments_debtors(client: TestClient, engine: Engine) -> None:
    variety_id = _priced_variety(client, price=11_000)

    debtor_id = _customer(client, "Debtor", "11 2000-0001")
    owing = client.post(
        "/sales",
        json={
            "customer_id": debtor_id,
            "payment": "owing",
            "date": "2026-09-14",
            "lines": [{"variety_id": variety_id, "grams": "10"}],
        },
    )
    assert owing.status_code == 201, owing.text

    settled_id = _customer(client, "Settled", "11 2000-0002")
    settled_sale = client.post(
        "/sales",
        json={
            "customer_id": settled_id,
            "payment": "owing",
            "date": "2026-09-14",
            "lines": [{"variety_id": variety_id, "grams": "1"}],
        },
    )
    assert settled_sale.status_code == 201, settled_sale.text
    settled_balance = client.get(f"/customers/{settled_id}/account").json()["balance"]
    settle_payment = client.post(
        f"/customers/{settled_id}/payments",
        json={"paid_on": "2026-09-15", "amount": settled_balance, "method": "cash"},
    )
    assert settle_payment.status_code == 201, settle_payment.text

    credit_id = _customer(client, "In credit", "11 2000-0003")
    credit_sale = client.post(
        "/sales",
        json={
            "customer_id": credit_id,
            "payment": "owing",
            "date": "2026-09-14",
            "lines": [{"variety_id": variety_id, "grams": "1"}],
        },
    )
    assert credit_sale.status_code == 201, credit_sale.text
    credit_balance = client.get(f"/customers/{credit_id}/account").json()["balance"]
    overpay = client.post(
        f"/customers/{credit_id}/payments",
        json={"paid_on": "2026-09-15", "amount": credit_balance, "method": "cash"},
    )
    assert overpay.status_code == 201, overpay.text

    expected = client.get("/payments/debtors").json()
    business_id = _business_id_of_customer(engine, debtor_id)

    with Session(engine) as session:
        answer = SqlDebtSummary(session, business_id).read()

    assert answer.total_owed == expected["total_owed"]
    assert answer.sales_owing_count == expected["sales_owing_count"]
    assert [row.customer_id for row in answer.debtors] == [
        d["customer"]["id"] for d in expected["debtors"]
    ]
    assert [row.name for row in answer.debtors] == [
        d["customer"]["name"] for d in expected["debtors"]
    ]
    assert [row.balance for row in answer.debtors] == [d["balance"] for d in expected["debtors"]]
    assert [row.owing_since.isoformat() for row in answer.debtors] == [
        d["owing_since"] for d in expected["debtors"]
    ]
    # Only the debtor appears: the credit and settled customers are absent from both.
    assert [row.customer_id for row in answer.debtors] == [debtor_id]
