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
from app.payments.application.ports import NamedLedger
from app.payments.application.view_accounts import Debtor, StillOwingLine
from app.payments.domain.settlement import Ledger, SaleSettlement, settle


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


def _business_of(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        customer = session.get(CustomerRow, customer_id)
        assert customer is not None
        return customer.business_id


def _phones_by_id(engine: Engine, customer_id: int) -> dict[int, str | None]:
    """`SqlLedgers.all()` of the business `customer_id` belongs to: id -> phone."""
    with Session(engine) as session:
        named = SqlLedgers(session, _business_of(engine, customer_id)).all()
        return {row.id: row.phone for row in named}


def test_all_answers_the_phone_exactly_as_the_customer_s_own_response_returned_it(
    client: TestClient, engine: Engine
) -> None:
    created = client.post(
        "/customers", json={"name": "Juana", "phone": "11 1000-0000", "phone_country": "AR"}
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["phone"] is not None

    assert _phones_by_id(engine, body["id"]) == {body["id"]: body["phone"]}


def test_all_answers_none_for_a_blank_phone_and_for_no_phone(
    client: TestClient, engine: Engine
) -> None:
    blank = client.post("/customers", json={"name": "En blanco", "phone": ""})
    assert blank.status_code == 201, blank.text
    absent = client.post("/customers", json={"name": "Sin telefono"})
    assert absent.status_code == 201, absent.text

    phones = _phones_by_id(engine, blank.json()["id"])

    assert phones == {blank.json()["id"]: None, absent.json()["id"]: None}


def test_each_business_sees_only_its_own_phones(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    mine = client.post(
        "/customers", json={"name": "Mia", "phone": "11 1000-0001", "phone_country": "AR"}
    ).json()
    theirs = other_client.post(
        "/customers", json={"name": "Teo", "phone": "11 1000-0002", "phone_country": "AR"}
    ).json()
    assert mine["phone"] != theirs["phone"]

    assert _phones_by_id(engine, mine["id"]) == {mine["id"]: mine["phone"]}
    assert _phones_by_id(engine, theirs["id"]) == {theirs["id"]: theirs["phone"]}


def test_a_named_ledger_and_a_debtor_do_not_show_the_phone_in_their_repr() -> None:
    phone = "+5491110000000"
    named = NamedLedger(id=1, name="Juana", ledger=Ledger((), ()), phone=phone)
    debtor = Debtor(
        customer_id=1,
        name="Juana",
        balance=1,
        owing_since=date(2026, 9, 14),
        standing="owes",
        age_days=0,
        bucket="this_week",
        customer_type_id=None,
        phone=phone,
        still_owing=(StillOwingLine(sale_number=1, sale_date=date(2026, 9, 14), remaining=1),),
    )

    assert phone not in repr(named)
    assert phone not in repr(debtor)
