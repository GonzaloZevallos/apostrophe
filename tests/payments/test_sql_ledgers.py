"""`SqlLedgers.for_customer` carries the Sale number the business sees, not the row id
(ADR-0073: Sale numbers are per Business), and `settle()` hands it on with the Sale's date.
"""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payments.adapters.sql_ledgers import SqlLedgers
from app.payments.domain.settlement import SaleSettlement, settle


def _owing_sale(client: TestClient, day: str) -> int:
    product = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 1_000},
    )
    customer = client.post(
        "/customers", json={"name": "Juana", "phone": "11 1000-0000", "phone_country": "AR"}
    ).json()
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": {"kind": "owing"},
            "date": day,
            "shipping_charged": 0,
            "lines": [{"product_id": product["id"], "quantity": "2"}],
        },
    )
    assert sale.status_code == 201, sale.text
    return int(customer["id"])


def test_the_ledger_carries_the_sale_number_of_its_business_not_the_row_id(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _owing_sale(other_client, "2026-09-01")
    customer_id = _owing_sale(client, "2026-09-14")

    with Session(engine) as session:
        customer = session.get(CustomerRow, customer_id)
        assert customer is not None
        ledger = SqlLedgers(session, customer.business_id).for_customer(customer_id)

    assert ledger is not None
    [sale] = ledger.sales
    assert sale.number == 1
    assert sale.number != sale.id
    assert settle(ledger).sales == (SaleSettlement(sale.id, date(2026, 9, 14), 1, sale.total),)
