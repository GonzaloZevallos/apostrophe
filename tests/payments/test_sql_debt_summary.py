"""`SqlDebtSummary`, results' `DebtSummary` port (CODING_STANDARDS section 5: adapter
test over real SQLite): `view_accounts.debtors()` unchanged, mapped to results' own
`Debts`/`DebtorRow`, checked against `GET /payments/debtors` over a seed with two
debtors (to prove the mapping keeps `debtors()`'s own order), a credit customer and a
settled customer.
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
    body: dict[str, int] = client.post("/customers", json={"name": name, "phone": phone}).json()
    return body["id"]


def _owing_sale(
    client: TestClient, customer_id: int, variety_id: int, *, quantity: str, date: str
) -> int:
    body = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
            "date": date,
            "lines": [{"variety_id": variety_id, "grams": quantity}],
        },
    )
    assert body.status_code == 201, body.text
    result: int = body.json()["id"]
    return result


def _business_id_of_customer(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        return row.business_id


def test_read_matches_get_payments_debtors(client: TestClient, engine: Engine) -> None:
    variety_id = _priced_variety(client, price=1_000)

    # Two debtors, dated apart, so the mapping's order is actually exercised: the
    # older one must come first, the same order `debtors()` itself answers in.
    older_debtor_id = _customer(client, "Older debtor", "11 2000-0001")
    _owing_sale(client, older_debtor_id, variety_id, quantity="10", date="2026-09-01")

    newer_debtor_id = _customer(client, "Newer debtor", "11 2000-0002")
    _owing_sale(client, newer_debtor_id, variety_id, quantity="5", date="2026-09-20")

    settled_id = _customer(client, "Settled", "11 2000-0003")
    _owing_sale(client, settled_id, variety_id, quantity="1", date="2026-09-14")
    settled_balance = client.get(f"/customers/{settled_id}/account").json()["balance"]
    settle_payment = client.post(
        f"/customers/{settled_id}/payments",
        json={"paid_on": "2026-09-15", "amount": settled_balance, "method": "cash"},
    )
    assert settle_payment.status_code == 201, settle_payment.text
    settled_account = client.get(f"/customers/{settled_id}/account").json()
    assert settled_account["standing"] == "settled"

    # A real credit, not merely a settled balance: pay the sale in full, then delete
    # it, the way `test_a_payment_s_fields_are_unchanged_after_a_sale_is_later_deleted`
    # (tests/payments/test_payments_router.py) does — the payment outlives the sale it
    # was recorded against, leaving the customer with nothing owed and money left over.
    credit_id = _customer(client, "In credit", "11 2000-0004")
    credit_sale_id = _owing_sale(client, credit_id, variety_id, quantity="1", date="2026-09-14")
    credit_balance = client.get(f"/customers/{credit_id}/account").json()["balance"]
    overpay = client.post(
        f"/customers/{credit_id}/payments",
        json={"paid_on": "2026-09-15", "amount": credit_balance, "method": "cash"},
    )
    assert overpay.status_code == 201, overpay.text
    deleted = client.delete(f"/sales/{credit_sale_id}")
    assert deleted.status_code == 200, deleted.text
    credit_account = client.get(f"/customers/{credit_id}/account").json()
    assert credit_account["standing"] == "credit", "the seed must produce a real credit"

    expected = client.get("/payments/debtors").json()
    business_id = _business_id_of_customer(engine, older_debtor_id)

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
    # The order itself, oldest debt first: both debtors appear, the credit and settled
    # customers appear in neither.
    assert [row.customer_id for row in answer.debtors] == [older_debtor_id, newer_debtor_id]
