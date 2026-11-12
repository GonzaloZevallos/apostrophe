"""A customer's phone read by the country sent with it, over `TestClient`
(docs/adr/20261111-phone-country-per-number):
a number typed without "+" is read by `phone_country`, a "+" number follows its own code
and ignores the country, a blank phone ignores it, no country asks for "+", a country
outside the list is refused, an untouched stored number never reads the country, a local
and an international spelling are one number, and the spreadsheet import stays Argentine."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow
from app.customers.adapters.import_port import CustomersImport
from app.customers.adapters.tables import CustomerRow
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.ports import CustomerKey, CustomerRefusals

PAIRS = [
    ("AR", "11 2345-6789", "+54 9 11 2345 6789", "+5491123456789"),
    ("UY", "099 123 456", "+598 99 123 456", "+59899123456"),
    ("CL", "9 1234 5678", "+56 9 1234 5678", "+56912345678"),
    ("PY", "0981 123 456", "+595 981 123 456", "+595981123456"),
    ("BR", "011 91234-5678", "+55 11 91234 5678", "+5511912345678"),
    ("MX", "55 1234 5678", "+52 55 1234 5678", "+525512345678"),
    ("ES", "612 34 56 78", "+34 612 34 56 78", "+34612345678"),
    ("US", "(212) 555-0123", "+1 212 555 0123", "+12125550123"),
]


def _post(client: TestClient, phone: str | None, code: str | None, name: str = "Nico") -> Any:
    return client.post("/customers", json={"name": name, "phone": phone, "phone_country": code})


def _patch(client: TestClient, customer_id: int, body: dict[str, Any]) -> Any:
    return client.patch(f"/customers/{customer_id}", json=body)


def _blank_customer(client: TestClient, name: str = "Otra") -> int:
    created = client.post("/customers", json={"name": name})
    assert created.status_code == 201, created.text
    return int(created.json()["id"])


def _store(engine: Engine, customer_id: int, phone: str) -> None:
    with Session(engine) as session:
        session.get_one(CustomerRow, customer_id).phone = phone
        session.commit()


@pytest.mark.parametrize(("code", "local", "international", "stored"), PAIRS)
def test_registering_reads_the_local_form_by_the_country_sent(
    client: TestClient, code: str, local: str, international: str, stored: str
) -> None:
    registered = _post(client, local, code)

    assert registered.status_code == 201, registered.text
    assert registered.json()["phone"] == stored


@pytest.mark.parametrize(("code", "local", "international", "stored"), PAIRS)
def test_editing_reads_the_local_form_by_the_country_sent(
    client: TestClient, code: str, local: str, international: str, stored: str
) -> None:
    edited = _patch(client, _blank_customer(client), {"phone": local, "phone_country": code})

    assert edited.status_code == 200, edited.text
    assert edited.json()["phone"] == stored


@pytest.mark.parametrize("sent", ["UY", "XX", "", None])
def test_a_plus_number_follows_its_own_code_whatever_country_is_sent(
    client: TestClient, sent: str | None
) -> None:
    registered = _post(client, "+54 9 11 2345 6789", sent)
    edited = _patch(
        client, _blank_customer(client), {"phone": "+598 99 123 456", "phone_country": sent}
    )

    assert registered.status_code == 201, registered.text
    assert registered.json()["phone"] == "+5491123456789"
    assert edited.status_code == 200, edited.text
    assert edited.json()["phone"] == "+59899123456"


@pytest.mark.parametrize("sent", ["UY", "XX", None])
@pytest.mark.parametrize("blank", [None, "", "   "])
def test_a_blank_phone_is_no_phone_and_ignores_the_country(
    client: TestClient, sent: str | None, blank: str | None
) -> None:
    registered = _post(client, blank, sent)
    with_phone = _post(client, "+598 99 123 456", None, "Vieja").json()["id"]
    edited = _patch(client, with_phone, {"phone": blank, "phone_country": sent})

    assert registered.status_code == 201, registered.text
    assert registered.json()["phone"] is None
    assert edited.status_code == 200, edited.text
    assert edited.json()["phone"] is None


def test_a_local_number_with_no_country_asks_for_the_plus_and_never_echoes_it(
    client: TestClient,
) -> None:
    registered = _post(client, "099 123 456", None, "Zulema Quiroga")
    edited = _patch(client, _blank_customer(client), {"phone": "099 123 456"})

    for refused in (registered, edited):
        assert refused.status_code == 422
        assert refused.json()["code"] == "customer.phone_needs_country_code"
        assert "099" not in refused.text and "Zulema" not in refused.text


@pytest.mark.parametrize("bogus", ["XX", "uy", "", "Uruguay", "598"])
def test_a_country_outside_the_list_is_refused_for_a_local_number(
    client: TestClient, bogus: str
) -> None:
    registered = _post(client, "099 123 456", bogus)
    edited = _patch(
        client, _blank_customer(client), {"phone": "099 123 456", "phone_country": bogus}
    )

    for refused in (registered, edited):
        assert refused.status_code == 422
        assert refused.json()["code"] == "customer.phone_country_unknown"
        assert refused.json()["detail"] == "The phone country is not one a business can choose"
        assert "099" not in refused.text


def test_a_refusal_never_echoes_the_number_or_the_name(client: TestClient) -> None:
    refused = _post(client, "12345", "UY", "Zulema Quiroga")

    assert refused.status_code == 422
    assert refused.json()["code"] == "customer.phone_invalid"
    assert "12345" not in refused.text and "Zulema" not in refused.text


@pytest.mark.parametrize("stored", ["+59899123456", "+5491123456789", "+4915112345678"])
@pytest.mark.parametrize("sent", ["XX", "AR", None])
def test_an_untouched_stored_number_never_reads_the_country(
    client: TestClient, engine: Engine, stored: str, sent: str | None
) -> None:
    customer_id = _blank_customer(client, "Vieja")
    _store(engine, customer_id, stored)

    sent_back = _patch(
        client, customer_id, {"name": "Vieja 2", "phone": stored, "phone_country": sent}
    )
    left_out = _patch(client, customer_id, {"name": "Vieja 3", "phone_country": sent})

    for edited in (sent_back, left_out):
        assert edited.status_code == 200, edited.text
        assert edited.json()["phone"] == stored
    assert left_out.json()["name"] == "Vieja 3"


def test_a_patch_with_only_the_country_changes_nothing(client: TestClient) -> None:
    created = _post(client, "099 123 456", "UY").json()

    edited = _patch(client, created["id"], {"phone_country": "AR"})
    bogus = _patch(client, created["id"], {"phone_country": "XX"})

    for answer in (edited, bogus):
        assert answer.status_code == 200, answer.text
        assert answer.json() == client.get(f"/customers/{created['id']}").json()
    assert client.get(f"/customers/{created['id']}").json()["phone"] == "+59899123456"


@pytest.mark.parametrize(("code", "local", "international", "stored"), PAIRS)
@pytest.mark.parametrize("local_first", [True, False])
def test_local_and_international_spellings_are_one_number_in_both_orders(
    client: TestClient, code: str, local: str, international: str, stored: str, local_first: bool
) -> None:
    first, second = (local, international) if local_first else (international, local)

    created = _post(client, first, code)
    duplicate = _post(client, second, code, "Otra")

    assert created.status_code == 201, created.text
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "customer.phone_taken"


@pytest.mark.parametrize(("code", "local", "international", "stored"), PAIRS)
def test_editing_to_the_other_spelling_of_a_taken_number_is_refused(
    client: TestClient, code: str, local: str, international: str, stored: str
) -> None:
    _post(client, local, code)

    edited = _patch(
        client, _blank_customer(client), {"phone": international, "phone_country": None}
    )

    assert edited.status_code == 409
    assert edited.json()["code"] == "customer.phone_taken"


@pytest.mark.parametrize(("code", "local", "international", "stored"), PAIRS)
def test_a_number_is_found_by_its_digits_in_any_spelling(
    client: TestClient, code: str, local: str, international: str, stored: str
) -> None:
    created = _post(client, local, code).json()

    for query in (local, international, stored[-7:]):
        found = client.get("/customers", params={"q": query}).json()
        assert [c["id"] for c in found] == [created["id"]], query


def test_the_import_reads_a_local_number_as_argentine(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        business_id = session.scalars(select(UserRow.business_id)).one()
        port = CustomersImport(session, business_id)

        checked = port.check_customer("Nico", "011 15 2345-6789")
        assert isinstance(checked, CustomerKey)
        assert checked.phone_key == "+5491123456789"
        refused = port.check_customer("Nico", "099 123 456")
        assert isinstance(refused, CustomerRefusals)
        assert refused.phone_code == "customer.phone_invalid"

        port.write_customer("Nico", checked.phone_key, None, NoCommit())
        stored = session.scalars(select(CustomerRow.phone)).all()
    assert stored == ["+5491123456789"]
