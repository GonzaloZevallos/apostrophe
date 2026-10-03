"""Customers through the HTTP API, over a real database (CODING_STANDARDS 5)."""

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import TODAY
from tests.contract_shapes import assert_matches_fixture


def _register(
    client: TestClient,
    name: str = "Fran Araujo",
    phone: str = "11 2345-6789",
    **rest: Any,
) -> dict[str, Any]:
    response = client.post("/customers", json={"name": name, "phone": phone, **rest})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_registered_customer_comes_back_with_the_canonical_phone(client: TestClient) -> None:
    customer = _register(client, "  Fran   Araujo ", "011 15 2345-6789")

    assert customer["name"] == "Fran Araujo"
    assert customer["phone"] == "+5491123456789"
    assert customer["channel"] is None
    assert customer["vip"] is False
    assert_matches_fixture(customer, "customer")


def test_a_freshly_registered_customer_has_no_balance(client: TestClient) -> None:
    customer = _register(client)

    assert customer["balance"] == 0
    assert customer["owing_since"] is None
    assert customer["standing"] == "settled"


def test_a_customer_with_a_sale_left_owing_shows_the_balance_everywhere_they_are_read(
    client: TestClient,
) -> None:
    customer = _register(client)
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"variety_id": variety["id"], "grams": "1"}],
        },
    )

    for read in (
        client.get(f"/customers/{customer['id']}").json(),
        next(c for c in client.get("/customers").json() if c["id"] == customer["id"]),
    ):
        assert read["balance"] == 10_000
        assert read["owing_since"] == TODAY.isoformat()
        assert read["standing"] == "owes"
        assert_matches_fixture(read, "customer")


def test_a_customer_can_be_registered_vip_with_a_channel(client: TestClient) -> None:
    customer = _register(client, channel="telegram", vip=True)

    assert customer["channel"] == "telegram"
    assert customer["vip"] is True


def test_a_customer_that_does_not_exist_is_not_found(client: TestClient) -> None:
    assert client.get("/customers/99").status_code == 404
    assert client.patch("/customers/99", json={"name": "Someone"}).status_code == 404


def test_two_customers_of_one_business_cannot_share_a_phone_number(client: TestClient) -> None:
    _register(client, "Fran Araujo", "11 2345-6789")

    again = client.post("/customers", json={"name": "Another Fran", "phone": "5491123456789"})

    assert again.status_code == 409
    assert "2345" not in again.text
    assert "6789" not in again.text
    assert "Fran" not in again.text


def test_two_businesses_may_each_register_the_same_phone_number(
    client: TestClient, other_client: TestClient
) -> None:
    _register(client, "Fran Araujo", "11 2345-6789")

    assert other_client.post(
        "/customers", json={"name": "Fran Araujo", "phone": "11 2345-6789"}
    ).status_code == 201


def test_an_invalid_phone_number_is_refused_without_repeating_it(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "Fran", "phone": "2345-6789"})

    assert response.status_code == 422
    assert response.json()["detail"] == "that doesn't look like a phone number with its area code"
    assert response.json()["code"] == "customer.phone_invalid"
    assert "2345" not in response.text


def test_a_missing_name_is_refused(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "   ", "phone": "11 2345-6789"})

    assert response.status_code == 422
    assert response.json()["detail"] == "a customer needs a name"


def test_customers_are_listed_sorted_by_name(client: TestClient) -> None:
    _register(client, "Zoe", "11 1111-1111")
    _register(client, "Álvaro Núñez", "11 2222-2222")

    names = [c["name"] for c in client.get("/customers").json()]

    assert names == ["Álvaro Núñez", "Zoe"]


def test_search_matches_by_part_of_the_name_ignoring_case_and_accents(client: TestClient) -> None:
    _register(client, "Álvaro Núñez", "11 2222-2222")
    _register(client, "Zoe", "11 1111-1111")

    found = client.get("/customers", params={"q": "alv"}).json()

    assert [c["name"] for c in found] == ["Álvaro Núñez"]


def test_search_matches_by_a_substring_of_the_phone_digits(client: TestClient) -> None:
    _register(client, "Fran Araujo", "11 2345-6789")

    found = client.get("/customers", params={"q": "02345"}).json()

    assert [c["name"] for c in found] == ["Fran Araujo"]


def test_an_empty_query_lists_every_customer(client: TestClient) -> None:
    _register(client, "Fran Araujo", "11 2345-6789")

    assert len(client.get("/customers", params={"q": ""}).json()) == 1
    assert len(client.get("/customers").json()) == 1


def test_editing_a_customer_keeps_fields_left_out_of_the_body(client: TestClient) -> None:
    customer = _register(client, channel="telegram", vip=True)

    edited = client.patch(f"/customers/{customer['id']}", json={"name": "New Name"})

    assert edited.status_code == 200
    assert edited.json()["name"] == "New Name"
    assert edited.json()["channel"] == "telegram"
    assert edited.json()["vip"] is True
    assert edited.json()["phone"] == customer["phone"]


def test_an_empty_patch_body_answers_the_customer_unchanged(client: TestClient) -> None:
    customer = _register(client)

    edited = client.patch(f"/customers/{customer['id']}", json={})

    assert edited.status_code == 200
    assert edited.json() == customer


def test_patching_channel_to_null_clears_it(client: TestClient) -> None:
    customer = _register(client, channel="whatsapp")

    edited = client.patch(f"/customers/{customer['id']}", json={"channel": None})

    assert edited.status_code == 200
    assert edited.json()["channel"] is None


def test_clearing_the_name_with_null_is_refused(client: TestClient) -> None:
    customer = _register(client)

    response = client.patch(f"/customers/{customer['id']}", json={"name": None})

    assert response.status_code == 422
    assert response.json()["detail"] == "name cannot be cleared"


def test_clearing_the_phone_with_null_is_refused(client: TestClient) -> None:
    customer = _register(client)

    response = client.patch(f"/customers/{customer['id']}", json={"phone": None})

    assert response.status_code == 422
    assert response.json()["detail"] == "phone cannot be cleared"


def test_clearing_vip_with_null_is_refused(client: TestClient) -> None:
    customer = _register(client, vip=True)

    response = client.patch(f"/customers/{customer['id']}", json={"vip": None})

    assert response.status_code == 422
    assert response.json()["detail"] == "vip cannot be cleared"


def test_sending_a_customers_own_number_back_on_edit_is_not_a_conflict(
    client: TestClient,
) -> None:
    customer = _register(client, "Fran Araujo", "11 2345-6789")

    edited = client.patch(
        f"/customers/{customer['id']}", json={"phone": "+54 9 11 2345 6789"}
    )

    assert edited.status_code == 200
    assert edited.json()["phone"] == "+5491123456789"


def test_editing_a_customers_phone_to_one_already_taken_is_refused(client: TestClient) -> None:
    _register(client, "Fran Araujo", "11 2345-6789")
    other = _register(client, "Zoe", "11 1111-1111")

    response = client.patch(f"/customers/{other['id']}", json={"phone": "11 2345-6789"})

    assert response.status_code == 409
    assert "2345" not in response.text
    assert "Fran" not in response.text


def test_editing_a_customer_that_does_not_exist_answers_404_before_checking_a_cleared_field(
    client: TestClient,
) -> None:
    response = client.patch("/customers/99", json={"name": None})

    assert response.status_code == 404


def test_a_validation_error_body_carries_no_input_ctx_or_url(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "Fran Araujo", "phone": 12345})

    assert response.status_code == 422
    for error in response.json()["detail"]:
        assert set(error) == {"loc", "type", "msg"}
    assert "12345" not in response.text
