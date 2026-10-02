"""Behaviour tests at the sales HTTP seam (CODING_STANDARDS section 5): the real
adapters, a fresh in-memory SQLite per test, `client`/`other_client` for isolation.

Covers what `app/sales/adapters/router.py` adds on top of the already-tested domain
and persistence: status codes, the response shape, and the refusal order for
assigning a customer (404 sale, then 422 customer, then 409 already assigned)."""

from fastapi.testclient import TestClient


def _variety(client: TestClient, list_price: int = 10_000) -> int:
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return int(variety["id"])


def _customer(client: TestClient) -> int:
    customer = client.post(
        "/customers", json={"name": "Juana", "phone": "11 2345-6789"}
    ).json()
    return int(customer["id"])


def test_record_sale_without_a_customer_paid_cash(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["customer_id"] is None
    assert body["payment"] == "cash"
    assert body["total"] == 100_000
    assert body["lines"] == [
        {
            "variety_id": variety_id,
            "grams": 10.0,
            "pricing_rule": "list",
            "price_per_gram": 10_000,
            "line_total": 100_000,
        }
    ]


def test_record_sale_left_owing_without_a_customer_is_refused(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={"payment": "owing", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    )

    assert response.status_code == 422, response.text


def test_record_sale_with_an_unknown_variety_is_refused(client: TestClient) -> None:
    response = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": 999_999, "grams": "10"}]}
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == "the variety does not exist"


def test_record_sale_with_an_unknown_customer_is_refused(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={
            "payment": "cash",
            "customer_id": 999_999,
            "lines": [{"variety_id": variety_id, "grams": "10"}],
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == "the customer does not exist"


def test_get_and_list_a_recorded_sale(client: TestClient) -> None:
    variety_id = _variety(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    ).json()["id"]

    got = client.get(f"/sales/{sale_id}")
    assert got.status_code == 200
    assert got.json()["id"] == sale_id

    listed = client.get("/sales")
    assert listed.status_code == 200
    assert [sale["id"] for sale in listed.json()] == [sale_id]


def test_delete_sale_removes_it(client: TestClient) -> None:
    variety_id = _variety(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    ).json()["id"]

    deleted = client.delete(f"/sales/{sale_id}")
    assert deleted.status_code == 204

    assert client.get(f"/sales/{sale_id}").status_code == 404


def test_assign_customer_to_a_sale_with_none(client: TestClient) -> None:
    variety_id = _variety(client)
    customer_id = _customer(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    ).json()["id"]

    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": customer_id})

    assert response.status_code == 200, response.text
    assert response.json()["customer_id"] == customer_id


def test_assign_customer_refusal_order_missing_sale_answers_404_even_with_a_bad_customer(
    client: TestClient,
) -> None:
    response = client.put("/sales/999999/customer", json={"customer_id": 999_999})

    assert response.status_code == 404, response.text


def test_assign_customer_refusal_order_unknown_customer_answers_422(
    client: TestClient,
) -> None:
    variety_id = _variety(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    ).json()["id"]

    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": 999_999})

    assert response.status_code == 422, response.text


def test_assign_customer_already_assigned_answers_409(client: TestClient) -> None:
    variety_id = _variety(client)
    first_customer = _customer(client)
    second_customer_response = client.post(
        "/customers", json={"name": "Otra", "phone": "11 9876-5432"}
    )
    second_customer = second_customer_response.json()["id"]
    sale_id = client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": first_customer,
            "lines": [{"variety_id": variety_id, "grams": "10"}],
        },
    ).json()["id"]

    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": second_customer})

    assert response.status_code == 409, response.text
