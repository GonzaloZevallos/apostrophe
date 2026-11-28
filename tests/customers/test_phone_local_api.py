"""`phone_local` on every customer response, over `TestClient`."""

from typing import Any

from fastapi.testclient import TestClient


def _register(client: TestClient, name: str, phone: str | None, country: str = "AR") -> Any:
    body: dict[str, Any] = {"name": name}
    if phone is not None:
        body["phone"] = phone
        body["phone_country"] = country
    response = client.post("/customers", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_detail_register_and_patch_carry_the_national_part(client: TestClient) -> None:
    created = _register(client, "Fran Araujo", "11 5555-0101")
    expected = {"country": "AR", "text": "11 5555-0101"}

    listed = client.get("/customers").json()
    detail = client.get(f"/customers/{created['id']}").json()
    edited = client.patch(f"/customers/{created['id']}", json={"name": "Fran A."}).json()

    assert created["phone_local"] == expected
    assert [row["phone_local"] for row in listed] == [expected]
    assert detail["phone_local"] == expected
    assert edited["phone_local"] == expected


def test_an_unlisted_plus_number_has_a_null_phone_local(client: TestClient) -> None:
    created = _register(client, "Londres", "+44 20 7946 0958")

    detail = client.get(f"/customers/{created['id']}").json()

    assert created["phone_local"] is None
    assert detail["phone_local"] is None
    assert [row["phone_local"] for row in client.get("/customers").json()] == [None]


def test_a_customer_with_no_phone_has_a_null_phone_local(client: TestClient) -> None:
    created = _register(client, "Sin Teléfono", None)

    detail = client.get(f"/customers/{created['id']}").json()

    assert created["phone_local"] is None
    assert detail["phone_local"] is None


def test_every_listed_country_example_is_read_back_with_its_own_code(
    client: TestClient,
) -> None:
    countries = client.get("/phone-countries").json()
    assert countries

    for entry in countries:
        created = _register(client, f"Cliente {entry['code']}", entry["example"], entry["code"])

        assert created["phone_local"] is not None, entry["code"]
        assert created["phone_local"]["country"] == entry["code"]


def test_a_patch_with_its_own_number_typed_nationally_keeps_it_and_is_not_taken(
    client: TestClient,
) -> None:
    created = _register(client, "Fran Araujo", "11 5555-0101")
    assert created["phone"] == "+5491155550101"

    edited = client.patch(
        f"/customers/{created['id']}", json={"phone": "11 5555-0101", "phone_country": "AR"}
    )

    assert edited.status_code == 200, edited.text
    assert edited.json().get("code") != "customer.phone_taken"
    assert edited.json()["phone"] == "+5491155550101"
    assert edited.json()["phone_local"] == {"country": "AR", "text": "11 5555-0101"}
