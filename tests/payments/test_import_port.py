"""`PaymentsImport.has_records` (app/payments/adapters/import_port.py): the spreadsheet
import's eligibility check, true for either kind of payment row — on-the-spot (carries
a `sale_id`) and later (does not) — and false when a business has neither. Seeded over
HTTP the way `tests/payments/test_sql_payments_guard.py` seeds its rows; only the port
under test is built and called directly.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payments.adapters.import_port import PaymentsImport


def _business_id_of_customer(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        return row.business_id


def _variety(client: TestClient) -> int:
    variety = client.post("/api/products", json={"name": "Import variety"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 1_000},
    )
    variety_id: int = variety["id"]
    return variety_id


def test_has_records_is_false_for_a_business_with_no_payment(
    client: TestClient, engine: Engine
) -> None:
    customer = client.post(
        "/customers", json={"name": "No Payment", "phone": "11 2222-3333"}
    ).json()
    business_id = _business_id_of_customer(engine, customer["id"])

    with Session(engine) as session:
        assert PaymentsImport(session, business_id).has_records() is False


def test_has_records_is_true_for_an_on_the_spot_payment(client: TestClient, engine: Engine) -> None:
    variety_id = _variety(client)
    customer = client.post(
        "/customers", json={"name": "Cash Customer", "phone": "11 2222-4444"}
    ).json()
    business_id = _business_id_of_customer(engine, customer["id"])

    sold = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "cash",
            "lines": [{"variety_id": variety_id, "quantity": "2"}],
        },
    )
    assert sold.status_code == 201, sold.text

    with Session(engine) as session:
        assert PaymentsImport(session, business_id).has_records() is True


def test_has_records_is_true_for_a_later_payment(client: TestClient, engine: Engine) -> None:
    variety_id = _variety(client)
    customer = client.post(
        "/customers", json={"name": "Later Customer", "phone": "11 2222-5555"}
    ).json()
    business_id = _business_id_of_customer(engine, customer["id"])

    sold = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"variety_id": variety_id, "quantity": "2"}],
        },
    )
    assert sold.status_code == 201, sold.text

    paid = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": "2026-09-20", "amount": 1, "method": "cash"},
    )
    assert paid.status_code == 201, paid.text

    with Session(engine) as session:
        assert PaymentsImport(session, business_id).has_records() is True
