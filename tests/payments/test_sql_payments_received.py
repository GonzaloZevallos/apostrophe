"""`SqlPaymentsReceived`, results' `PaymentsReceived` port for Caja (CODING_STANDARDS
section 5: adapter test over real SQLite). Seeded over `client`, the way
`tests/payments/test_sql_payments_guard.py` seeds `SqlPayments`; only the port itself is
built and called directly.
"""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payments.adapters.results_ports import SqlPaymentsReceived
from app.results.domain.periods import Period


def _priced_variety(client: TestClient, *, price: int = 1_000) -> int:
    variety: dict[str, int] = client.post("/varieties", json={"name": "Variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": price},
    )
    return variety["id"]


def _business_id_of_customer(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        return row.business_id


def test_totals_count_on_the_spot_and_later_payments_each_on_their_own_paid_on(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _priced_variety(client, price=2_000)
    # An on-the-spot payment on a sale with no customer: it must count too (the plan's
    # invariant that `PaymentsReceived` applies no kind filter and never goes through
    # `Ledgers`).
    on_the_spot = client.post(
        "/sales",
        json={
            "payment": "cash",
            "date": "2026-09-05",
            "lines": [{"variety_id": variety_id, "grams": "1"}],
        },
    )
    assert on_the_spot.status_code == 201, on_the_spot.text

    customer = client.post(
        "/customers", json={"name": "Later payer", "phone": "11 4000-0000"}
    ).json()
    customer_id = customer["id"]
    owing = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
            "date": "2026-09-05",
            "lines": [{"variety_id": variety_id, "grams": "5"}],
        },
    )
    assert owing.status_code == 201, owing.text
    later = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-28", "amount": 3_000, "method": "transfer"},
    )
    assert later.status_code == 201, later.text

    business_id = _business_id_of_customer(engine, customer_id)
    september = Period(date(2026, 9, 1), date(2026, 9, 30))
    first_half = Period(date(2026, 9, 1), date(2026, 9, 10))

    with Session(engine) as session:
        totals = SqlPaymentsReceived(session, business_id).totals([september, first_half])

    assert totals[september] == 2_000 + 3_000
    assert totals[first_half] == 2_000


def test_another_business_s_payments_are_absent(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    variety_id = _priced_variety(client, price=5_000)
    on_the_spot = client.post(
        "/sales",
        json={
            "payment": "cash",
            "date": "2026-10-01",
            "lines": [{"variety_id": variety_id, "grams": "1"}],
        },
    )
    assert on_the_spot.status_code == 201, on_the_spot.text

    other_customer = other_client.post(
        "/customers", json={"name": "Other business's customer", "phone": "11 6000-0000"}
    ).json()
    other_business_id = _business_id_of_customer(engine, other_customer["id"])

    with Session(engine) as session:
        totals = SqlPaymentsReceived(session, other_business_id).totals(
            [Period(date(2026, 10, 1), date(2026, 10, 31))]
        )

    assert all(total == 0 for total in totals.values())
