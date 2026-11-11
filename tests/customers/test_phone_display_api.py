"""`phone_display` on a customer read, and `GET /phone-countries`, over `TestClient`."""

from typing import Any

import pytest
from fastapi.testclient import TestClient


def _register(client: TestClient, name: str, phone: str | None) -> dict[str, Any]:
    body: dict[str, Any] = {"name": name}
    if phone is not None:
        body["phone"] = phone
        body["phone_country"] = "AR"
    response = client.post("/customers", json=body)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def test_the_list_and_the_detail_carry_the_grouped_phone(client: TestClient) -> None:
    created = _register(client, "Fran Araujo", "11 2345-6789")

    listed = client.get("/customers").json()
    detail = client.get(f"/customers/{created['id']}").json()

    assert created["phone"] == "+5491123456789"
    assert created["phone_display"] == "+54 9 11 2345-6789"
    assert [row["phone_display"] for row in listed] == ["+54 9 11 2345-6789"]
    assert detail["phone_display"] == "+54 9 11 2345-6789"


def test_a_customer_with_no_phone_has_no_grouped_phone(client: TestClient) -> None:
    created = _register(client, "Sin Teléfono", None)

    detail = client.get(f"/customers/{created['id']}").json()

    assert detail["phone"] is None
    assert detail["phone_display"] is None


def test_a_number_that_fits_no_template_is_shown_as_stored(client: TestClient) -> None:
    created = _register(client, "Londres", "+44 20 7946 0958")

    assert created["phone_display"] == created["phone"] == "+442079460958"


@pytest.mark.parametrize("country", ["AR", None, "ES"])
def test_the_business_phone_country_never_decides_the_grouping(
    client: TestClient, country: str | None
) -> None:
    assert client.put("/business/phone-country", json={"phone_country": country}).status_code == 200

    created = _register(client, "Uruguayo", "+598 99 123 456")

    assert created["phone_display"] == "+598 99 123 456"
    assert client.get(f"/customers/{created['id']}").json()["phone_display"] == "+598 99 123 456"


EXPECTED = [
    {"code": "AR", "calling_code": "54", "national_lengths": [10], "example": "11 2345-6789"},
    {"code": "UY", "calling_code": "598", "national_lengths": [8], "example": "099 123 456"},
    {"code": "CL", "calling_code": "56", "national_lengths": [9], "example": "9 1234 5678"},
    {"code": "PY", "calling_code": "595", "national_lengths": [8, 9], "example": "0981 123 456"},
    {
        "code": "BR",
        "calling_code": "55",
        "national_lengths": [10, 11],
        "example": "(11) 91234-5678",
    },
    {"code": "MX", "calling_code": "52", "national_lengths": [10], "example": "55 1234 5678"},
    {"code": "ES", "calling_code": "34", "national_lengths": [9], "example": "612 34 56 78"},
    {"code": "US", "calling_code": "1", "national_lengths": [10], "example": "(212) 555-0123"},
]


def test_the_phone_countries_have_the_agreed_shape_and_order(client: TestClient) -> None:
    response = client.get("/phone-countries")

    assert response.status_code == 200
    assert response.json() == EXPECTED


def test_another_business_gets_the_same_phone_countries(
    client: TestClient, other_client: TestClient
) -> None:
    assert client.get("/phone-countries").json() == other_client.get("/phone-countries").json()


def test_business_and_phone_countries_list_the_same_countries_in_the_same_order(
    client: TestClient,
) -> None:
    in_business = client.get("/business").json()["phone_countries"]
    listed = client.get("/phone-countries").json()

    assert [(c["code"], c["calling_code"]) for c in in_business] == [
        (c["code"], c["calling_code"]) for c in listed
    ]
