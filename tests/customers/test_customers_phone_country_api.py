"""A customer's phone read by the business's Phone country, over `TestClient`
(docs/adr/0073): the next local number follows the country, no country asks for "+", a
local and an international spelling are one number, an untouched stored number is kept,
and the spreadsheet import stays Argentine."""

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


def _country(client: TestClient, code: str | None) -> None:
    changed = client.put("/business/phone-country", json={"phone_country": code})
    assert changed.status_code == 200, changed.text


def _post(client: TestClient, phone: str, name: str = "Nico") -> Any:
    return client.post("/customers", json={"name": name, "phone": phone})


def test_changing_the_phone_country_makes_the_next_local_number_follow_it(
    client: TestClient,
) -> None:
    _country(client, "UY")
    uruguayan = _post(client, "099 123 456")
    _country(client, "ES")
    spanish = _post(client, "612 34 56 78", "Eva")

    assert uruguayan.status_code == 201, uruguayan.text
    assert uruguayan.json()["phone"] == "+59899123456"
    assert spanish.json()["phone"] == "+34612345678"


def test_with_no_country_a_local_number_is_refused_and_a_plus_number_accepted(
    client: TestClient,
) -> None:
    _country(client, None)

    refused = _post(client, "099 123 456")
    accepted = _post(client, "+598 99 123 456")

    assert refused.status_code == 422
    assert refused.json()["code"] == "customer.phone_needs_country_code"
    assert "099" not in refused.text and "Nico" not in refused.text
    assert accepted.status_code == 201
    assert accepted.json()["phone"] == "+59899123456"


def test_a_refusal_never_echoes_the_number_or_the_name(client: TestClient) -> None:
    _country(client, "UY")

    refused = _post(client, "12345", "Zulema Quiroga")

    assert refused.status_code == 422
    assert refused.json()["code"] == "customer.phone_invalid"
    assert "12345" not in refused.text and "Zulema" not in refused.text


PAIRS = [
    ("AR", "11 2345-6789", "+54 9 11 2345 6789"),
    ("UY", "099 123 456", "+598 99 123 456"),
    ("CL", "9 1234 5678", "+56 9 1234 5678"),
    ("PY", "0981 123 456", "+595 981 123 456"),
    ("BR", "011 91234-5678", "+55 11 91234 5678"),
    ("MX", "55 1234 5678", "+52 55 1234 5678"),
    ("ES", "612 34 56 78", "+34 612 34 56 78"),
    ("US", "(212) 555-0123", "+1 212 555 0123"),
]


@pytest.mark.parametrize(("code", "local", "international"), PAIRS)
@pytest.mark.parametrize("local_first", [True, False])
def test_local_and_international_spellings_are_one_number_in_both_orders(
    client: TestClient, code: str, local: str, international: str, local_first: bool
) -> None:
    _country(client, code)
    first, second = (local, international) if local_first else (international, local)

    created = _post(client, first)
    duplicate = _post(client, second, "Otra")

    assert created.status_code == 201, created.text
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "customer.phone_taken"


@pytest.mark.parametrize(("code", "local", "international"), PAIRS)
def test_editing_to_the_other_spelling_of_a_taken_number_is_refused(
    client: TestClient, code: str, local: str, international: str
) -> None:
    _country(client, code)
    _post(client, local)
    other = client.post("/customers", json={"name": "Otra"}).json()

    edited = client.patch(f"/customers/{other['id']}", json={"phone": international})

    assert edited.status_code == 409
    assert edited.json()["code"] == "customer.phone_taken"


@pytest.mark.parametrize("code", ["UY", None])
@pytest.mark.parametrize("stored", ["+5215512345678", "+59899123", "+1234567890123"])
def test_a_stored_number_no_rule_produces_saves_unchanged_when_sent_back(
    client: TestClient, engine: Engine, code: str | None, stored: str
) -> None:
    created = client.post("/customers", json={"name": "Vieja"}).json()
    with Session(engine) as session:
        row = session.get_one(CustomerRow, created["id"])
        row.phone = stored
        session.commit()
    _country(client, code)

    edited = client.patch(f"/customers/{created['id']}", json={"name": "Vieja 2", "phone": stored})

    assert edited.status_code == 200, edited.text
    assert edited.json()["phone"] == stored
    assert edited.json()["name"] == "Vieja 2"


@pytest.mark.parametrize("code", ["UY", None])
def test_the_import_reads_a_local_number_as_argentine_in_any_country(
    client: TestClient, engine: Engine, code: str | None
) -> None:
    _country(client, code)
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
