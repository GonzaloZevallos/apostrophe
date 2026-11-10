"""The business's Phone country through `TestClient` (docs/adr/0082): `GET /business`
lists the options and the stored code, `PUT /business/phone-country` sets or clears it,
and a code that is not listed is refused with nothing changed."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow

OPTIONS = [
    {"code": "AR", "calling_code": "54"},
    {"code": "UY", "calling_code": "598"},
    {"code": "CL", "calling_code": "56"},
    {"code": "PY", "calling_code": "595"},
    {"code": "BR", "calling_code": "55"},
    {"code": "MX", "calling_code": "52"},
    {"code": "ES", "calling_code": "34"},
    {"code": "US", "calling_code": "1"},
]


def _change(client: TestClient, code: str | None) -> Any:
    return client.put("/business/phone-country", json={"phone_country": code})


def _stored(client: TestClient) -> str | None:
    country: str | None = client.get("/business").json()["phone_country"]
    return country


def test_a_new_business_starts_with_no_phone_country_and_lists_the_eight_in_order(
    client: TestClient,
) -> None:
    _change(client, None)  # the suite's clients are set to Argentina; a new business has none

    business = client.get("/business").json()

    assert business["phone_country"] is None
    assert business["phone_countries"] == OPTIONS


def test_the_country_goes_none_uy_us_none_and_each_step_reads_back(client: TestClient) -> None:
    to_uruguay = _change(client, "UY")
    assert to_uruguay.status_code == 200, to_uruguay.text
    assert to_uruguay.json() == {"phone_country": "UY", "phone_countries": OPTIONS}
    assert _stored(client) == "UY"

    assert _change(client, "US").json()["phone_country"] == "US"
    assert _stored(client) == "US"

    cleared = _change(client, None)
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["phone_country"] is None
    assert _stored(client) is None


@pytest.mark.parametrize("code", ["XX", "uy", "", "ARG", "54", " AR", "AR "])
def test_a_code_that_is_not_listed_is_refused_and_nothing_changes(
    client: TestClient, code: str
) -> None:
    _change(client, "UY")

    refused = _change(client, code)

    assert refused.status_code == 422
    assert refused.json()["code"] == "business.phone_country_unknown"
    detail = refused.json()["detail"]
    assert detail, "the refusal names the rule"
    # The sentence is the fixed rule, the same whatever the value was.
    assert detail == _change(client, "another-value").json()["detail"]
    assert _stored(client) == "UY"


def test_a_rename_keeps_the_phone_country(client: TestClient) -> None:
    _change(client, "BR")

    renamed = client.patch("/business", json={"name": "Nuevo Nombre"})

    assert renamed.status_code == 200
    assert renamed.json()["phone_country"] == "BR"
    assert _stored(client) == "BR"


def test_a_language_change_keeps_the_phone_country(client: TestClient) -> None:
    _change(client, "ES")

    client.put("/business/language", json={"language": "en"})

    assert _stored(client) == "ES"


def test_one_business_changing_its_country_leaves_the_other(
    client: TestClient, other_client: TestClient
) -> None:
    _change(client, None)
    _change(other_client, "MX")

    assert _stored(other_client) == "MX"
    assert _stored(client) is None


def test_the_stored_column_holds_the_code_and_a_change_leaves_customers_alone(
    client: TestClient, engine: Engine
) -> None:
    created = client.post("/customers", json={"name": "Ana", "phone": "+5491123456789"})
    assert created.status_code == 201, created.text

    _change(client, "UY")

    with Session(engine) as session:
        stored = session.query(BusinessRow.default_phone_country).all()
    assert [row[0] for row in stored].count("UY") == 1
    assert client.get(f"/customers/{created.json()['id']}").json()["phone"] == "+5491123456789"
