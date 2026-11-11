"""The Sale number at the sales HTTP seam (CONTEXT.md: Sale number, docs/adr/0073): the
real adapters over a fresh in-memory SQLite. The first sale of a business is #1, each next
one follows, a deleted number is never given again, and the detail and the bill carry the
same number."""

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import TODAY


def _variety(client: TestClient) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(variety["id"])


def _sell(client: TestClient, variety_id: int, **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "payment": {"kind": "paid", "payment_method_id": 1},
        "lines": [{"product_id": variety_id, "quantity": "1"}],
        **extra,
    }
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    return dict(response.json())


def test_the_first_sale_is_number_1_and_the_second_is_number_2(client: TestClient) -> None:
    variety_id = _variety(client)

    first = _sell(client, variety_id)
    second = _sell(client, variety_id)

    assert (first["number"], second["number"]) == (1, 2)


def test_the_detail_and_the_bill_carry_the_same_number(client: TestClient) -> None:
    variety_id = _variety(client)
    _sell(client, variety_id)
    sale = _sell(client, variety_id)

    detail = client.get(f"/sales/{sale['id']}").json()

    assert detail["number"] == 2
    assert detail["bill"]["number"] == 2
    listed = {row["id"]: row["number"] for row in client.get("/sales").json()}
    assert listed[sale["id"]] == 2


def test_a_deleted_number_is_never_given_again(client: TestClient) -> None:
    variety_id = _variety(client)
    _sell(client, variety_id)
    second = _sell(client, variety_id)
    assert client.delete(f"/sales/{second['id']}").status_code == 200

    third = _sell(client, variety_id)

    assert third["number"] == 3


def test_a_backdated_sale_gets_the_next_number(client: TestClient) -> None:
    variety_id = _variety(client)
    _sell(client, variety_id)

    backdated = _sell(client, variety_id, date="2026-02-01")

    assert backdated["number"] == 2
    assert backdated["date"] < TODAY.isoformat()


def test_assigning_a_customer_later_does_not_change_the_number(client: TestClient) -> None:
    variety_id = _variety(client)
    _sell(client, variety_id)
    sale = _sell(client, variety_id)
    customer = client.post("/customers", json={"name": "Juana", "phone": "11 2345-6789"}).json()

    assigned = client.put(f"/sales/{sale['id']}/customer", json={"customer_id": customer["id"]})

    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["number"] == 2
    assert client.get(f"/sales/{sale['id']}").json()["number"] == 2
