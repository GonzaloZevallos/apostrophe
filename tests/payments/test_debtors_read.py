"""`GET /payments/debtors` cost and agreement (ADR-0012, ADR-0038): the read stays at a fixed number
of statements however many customers owe, and Inicio's Te deben block (`GET /panel`) is the same
read as Clientes' (`GET /payments/debtors`), credit customers left out of both.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.statement_log import captured_statements

SALE_DATE = "2026-09-14"
PRICE = 1_000


def _priced_variety(client: TestClient) -> int:
    variety: dict[str, int] = client.post("/varieties", json={"name": "Variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": PRICE},
    )
    return variety["id"]


def _owing_sale(client: TestClient, customer_id: int, variety_id: int, quantity: int) -> int:
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
            "date": SALE_DATE,
            "lines": [{"variety_id": variety_id, "quantity": str(quantity)}],
        },
    )
    assert sale.status_code == 201, sale.text
    sale_id: int = sale.json()["id"]
    return sale_id


def _customer(client: TestClient, index: int) -> int:
    customer = client.post(
        "/customers", json={"name": f"Debtor {index:03d}", "phone": f"11 4{index:03d}-{index:04d}"}
    )
    assert customer.status_code == 201, customer.text
    customer_id: int = customer.json()["id"]
    return customer_id


def _sale_total(client: TestClient, sale_id: int) -> int:
    total: int = client.get(f"/sales/{sale_id}").json()["total"]
    return total


def _seed_debtors(client: TestClient, how_many: int) -> None:
    variety_id = _priced_variety(client)
    for index in range(how_many):
        _owing_sale(client, _customer(client, index), variety_id, index + 1)


def _statement_count(engine: Engine, client: TestClient) -> int:
    with captured_statements(engine) as statements:
        response = client.get("/payments/debtors")
        assert response.status_code == 200, response.text
    return len(statements)


def test_debtors_issues_the_same_number_of_statements_with_ten_and_with_fifty(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _seed_debtors(client, 10)
    _seed_debtors(other_client, 50)

    assert len(client.get("/payments/debtors").json()["debtors"]) == 10
    assert len(other_client.get("/payments/debtors").json()["debtors"]) == 50
    ten = _statement_count(engine, client)
    fifty = _statement_count(engine, other_client)

    assert ten == fifty, (ten, fifty)


def test_panel_and_debtors_agree_with_a_direct_computation_and_a_credit_customer(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client)
    first, second, credit = (_customer(client, index) for index in (1, 2, 3))
    first_sale = _owing_sale(client, first, variety_id, 7)
    second_sale = _owing_sale(client, second, variety_id, 3)
    # The third customer settles two sales, then one is deleted: what they paid for it stays
    # with them as credit, so their balance is below $0.
    kept = _owing_sale(client, credit, variety_id, 2)
    removed = _owing_sale(client, credit, variety_id, 4)
    paid = client.post(
        f"/customers/{credit}/payments",
        json={
            "paid_on": "2026-10-01",
            "amount": _sale_total(client, kept) + _sale_total(client, removed),
            "method": "cash",
        },
    )
    assert paid.status_code == 201, paid.text
    assert client.delete(f"/sales/{removed}").status_code == 200
    assert client.get(f"/customers/{credit}/account").json()["standing"] == "credit"

    debtors = client.get("/payments/debtors").json()
    panel = client.get("/panel").json()["debts"]

    owed = [_sale_total(client, first_sale), _sale_total(client, second_sale)]
    assert [row["customer"]["id"] for row in debtors["debtors"]] == [first, second]
    assert [row["balance"] for row in debtors["debtors"]] == owed
    assert debtors["total_owed"] == sum(owed)
    assert debtors["sales_owing_count"] == 2
    assert panel["total_owed"] == debtors["total_owed"]
    assert panel["sales_owing_count"] == debtors["sales_owing_count"]
    assert panel["oldest"] == debtors["debtors"][0]["owing_since"]
    assert [row["customer_id"] for row in panel["teaser"]] == [first, second]
    assert [row["balance"] for row in panel["teaser"]] == owed
