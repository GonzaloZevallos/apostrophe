"""Customers through the HTTP API, over a real database (CODING_STANDARDS 5)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.conftest import TODAY
from tests.contract_shapes import assert_matches_fixture
from tests.pricing_switches import set_switches


def _register(
    client: TestClient,
    name: str = "Fran Araujo",
    phone: str | None = "11 2345-6789",
    **rest: Any,
) -> dict[str, Any]:
    body_in: dict[str, Any] = {"name": name, **rest}
    if phone is not None:
        body_in["phone"] = phone
    response = client.post("/customers", json=body_in)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_registered_customer_comes_back_with_the_canonical_phone(client: TestClient) -> None:
    customer = _register(client, "  Fran   Araujo ", "011 15 2345-6789")

    assert customer["name"] == "Fran Araujo"
    assert customer["phone"] == "+5491123456789"
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
            "lines": [{"variety_id": variety["id"], "quantity": "1"}],
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


def test_a_later_payment_lowers_the_balance_everywhere_it_is_read(client: TestClient) -> None:
    """Review finding (balances-wiring): no HTTP test recorded a later payment and
    then re-read `GET /customers/{id}`, `GET /customers` or `GET /sales` — wiring
    that ignored payments entirely (balance stuck at the sale's total, `still_owing`
    stuck `True`) would have left every test green. This proves the wrong answer
    (balance unchanged, sale still fully owing) is the one case a correct `Balances`/
    `OwingSales` wiring must reject."""
    customer = _register(client)
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"variety_id": variety["id"], "quantity": "1"}],
        },
    ).json()

    payment = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY.isoformat(), "amount": 4_000, "method": "cash"},
    )
    assert payment.status_code == 201, payment.text

    after_customer = client.get(f"/customers/{customer['id']}").json()
    assert after_customer["balance"] == 6_000
    assert after_customer["standing"] == "owes"
    listed = next(c for c in client.get("/customers").json() if c["id"] == customer["id"])
    assert listed["balance"] == 6_000
    sale_after = next(s for s in client.get("/sales").json() if s["id"] == sale["id"])
    assert sale_after["still_owing"] is True

    full = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY.isoformat(), "amount": 6_000, "method": "cash"},
    )
    assert full.status_code == 201, full.text

    settled_customer = client.get(f"/customers/{customer['id']}").json()
    assert settled_customer["balance"] == 0
    assert settled_customer["standing"] == "settled"
    sale_settled = next(s for s in client.get("/sales").json() if s["id"] == sale["id"])
    assert sale_settled["still_owing"] is False


def test_a_customer_can_be_registered_vip(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=False, vip=True)
    customer = _register(client, vip=True)

    assert customer["vip"] is True


@pytest.mark.parametrize("sent", ["telegram", "carrier-pigeon", None])
def test_registering_with_a_channel_in_the_body_succeeds_and_stores_nothing(
    client: TestClient, sent: str | None
) -> None:
    created = client.post(
        "/customers", json={"name": "Fran Araujo", "phone": "11 2345-6789", "channel": sent}
    )

    assert created.status_code == 201, created.text
    assert "channel" not in created.json()
    assert "channel" not in client.get(f"/customers/{created.json()['id']}").json()
    assert all("channel" not in c for c in client.get("/customers").json())


def test_patching_with_a_channel_in_the_body_succeeds_and_stores_nothing(
    client: TestClient,
) -> None:
    customer = _register(client)

    edited = client.patch(
        f"/customers/{customer['id']}", json={"name": "Fran B", "channel": "whatsapp"}
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["name"] == "Fran B"
    assert "channel" not in edited.json()
    assert "channel" not in client.get(f"/customers/{customer['id']}").json()


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

    assert (
        other_client.post(
            "/customers", json={"name": "Fran Araujo", "phone": "11 2345-6789"}
        ).status_code
        == 201
    )


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


def test_editing_a_customer_keeps_fields_left_out_of_the_body(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=True)
    customer = _register(client, vip=True)

    edited = client.patch(f"/customers/{customer['id']}", json={"name": "New Name"})

    assert edited.status_code == 200
    assert edited.json()["name"] == "New Name"
    assert edited.json()["vip"] is True
    assert edited.json()["phone"] == customer["phone"]


def test_an_empty_patch_body_answers_the_customer_unchanged(client: TestClient) -> None:
    customer = _register(client)

    edited = client.patch(f"/customers/{customer['id']}", json={})

    assert edited.status_code == 200
    assert edited.json() == customer


def test_clearing_the_name_with_null_is_refused(client: TestClient) -> None:
    customer = _register(client)

    response = client.patch(f"/customers/{customer['id']}", json={"name": None})

    assert response.status_code == 422
    assert response.json()["detail"] == "name cannot be cleared"


def test_clearing_the_phone_with_null_is_allowed(client: TestClient) -> None:
    customer = _register(client)

    response = client.patch(f"/customers/{customer['id']}", json={"phone": None})

    assert response.status_code == 200
    assert response.json()["phone"] is None


def test_clearing_the_phone_with_an_empty_string_is_allowed(client: TestClient) -> None:
    customer = _register(client)

    response = client.patch(f"/customers/{customer['id']}", json={"phone": ""})

    assert response.status_code == 200
    assert response.json()["phone"] is None


@pytest.mark.parametrize("cleared_with", [None, ""])
def test_clearing_the_phone_keeps_the_customers_sales_payments_and_balance(
    client: TestClient, cleared_with: str | None
) -> None:
    customer = _register(client)
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"variety_id": variety["id"], "quantity": "1"}],
        },
    ).json()
    payment = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY.isoformat(), "amount": 4_000, "method": "cash"},
    ).json()

    cleared = client.patch(f"/customers/{customer['id']}", json={"phone": cleared_with})

    assert cleared.status_code == 200
    assert cleared.json()["phone"] is None
    assert cleared.json()["balance"] == 6_000
    sales_after = client.get("/sales").json()
    assert any(
        s["customer"] is not None and s["customer"]["id"] == customer["id"] for s in sales_after
    )
    sale_after = next(s for s in sales_after if s["id"] == sale["id"])
    assert sale_after["still_owing"] is True
    account_after = client.get(f"/customers/{customer['id']}/account").json()
    assert any(
        "payment" in row and row["payment"]["id"] == payment["payment"]["id"]
        for row in account_after["rows"]
    )


def test_clearing_vip_with_null_is_refused(client: TestClient) -> None:
    customer = _register(client, vip=True)

    response = client.patch(f"/customers/{customer['id']}", json={"vip": None})

    assert response.status_code == 422
    assert response.json()["detail"] == "vip cannot be cleared"


def test_sending_a_customers_own_number_back_on_edit_is_not_a_conflict(
    client: TestClient,
) -> None:
    customer = _register(client, "Fran Araujo", "11 2345-6789")

    edited = client.patch(f"/customers/{customer['id']}", json={"phone": "+54 9 11 2345 6789"})

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


# -- A phone is optional (ADR-0021) ----------------------------------------------------


def test_registering_with_no_phone_field_answers_phone_null(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "Sin Numero"})

    assert response.status_code == 201, response.text
    assert response.json()["phone"] is None


def test_registering_with_an_explicit_null_phone_answers_phone_null(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "Sin Numero", "phone": None})

    assert response.status_code == 201, response.text
    assert response.json()["phone"] is None


def test_registering_with_an_empty_string_phone_answers_phone_null(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "Sin Numero", "phone": ""})

    assert response.status_code == 201, response.text
    assert response.json()["phone"] is None


def test_registering_with_a_blank_phone_answers_phone_null(client: TestClient) -> None:
    response = client.post("/customers", json={"name": "Sin Numero", "phone": "   "})

    assert response.status_code == 201, response.text
    assert response.json()["phone"] is None


def test_two_customers_with_no_phone_coexist(client: TestClient) -> None:
    first = client.post("/customers", json={"name": "Primero"})
    second = client.post("/customers", json={"name": "Segundo"})

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["phone"] is None
    assert second.json()["phone"] is None


def test_a_malformed_phone_is_still_refused_when_most_customers_have_none(
    client: TestClient,
) -> None:
    client.post("/customers", json={"name": "Sin Numero"})

    response = client.post("/customers", json={"name": "Otro", "phone": "2345-6789"})

    assert response.status_code == 422
    assert response.json()["code"] == "customer.phone_invalid"


def test_search_finds_a_no_phone_customer_by_name(client: TestClient) -> None:
    client.post("/customers", json={"name": "Sin Numero"})

    found = client.get("/customers", params={"q": "Sin Numero"}).json()

    assert [c["name"] for c in found] == ["Sin Numero"]


def test_search_by_digits_never_matches_a_no_phone_customer(client: TestClient) -> None:
    client.post("/customers", json={"name": "Sin Numero"})

    found = client.get("/customers", params={"q": "2345"}).json()

    assert found == []


def test_a_no_phone_customer_can_be_chosen_for_a_sale_left_owing_and_paid(
    client: TestClient,
) -> None:
    customer = _register(client, "Sin Numero", None)
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )

    sale = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"variety_id": variety["id"], "quantity": "1"}],
        },
    )
    assert sale.status_code == 201, sale.text

    debtors = client.get("/payments/debtors").json()
    assert any(debtor["customer"]["id"] == customer["id"] for debtor in debtors["debtors"])

    payment = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY.isoformat(), "amount": 10_000, "method": "cash"},
    )
    assert payment.status_code == 201, payment.text

    settled = client.get(f"/customers/{customer['id']}").json()
    assert settled["balance"] == 0
    assert settled["standing"] == "settled"


def test_with_clientes_vip_off_a_customer_registered_vip_is_not_vip(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=False)

    customer = _register(client, vip=True)

    assert customer["vip"] is False
    assert client.get(f"/customers/{customer['id']}").json()["vip"] is False


def test_with_clientes_vip_off_editing_a_vip_customer_never_changes_the_mark(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=True)
    customer = _register(client, vip=True)
    set_switches(engine, bulk=False, vip=False)

    cleared = client.patch(f"/customers/{customer['id']}", json={"vip": False, "name": "Fran B"})
    left_out = client.patch(f"/customers/{customer['id']}", json={"phone": None})

    assert cleared.status_code == 200
    assert (cleared.json()["vip"], cleared.json()["name"]) == (True, "Fran B")
    assert left_out.json()["vip"] is True


def test_with_clientes_vip_off_editing_a_regular_customer_with_vip_true_keeps_them_regular(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=False)
    customer = _register(client)

    edited = client.patch(f"/customers/{customer['id']}", json={"vip": True})

    assert edited.status_code == 200
    assert edited.json()["vip"] is False


def test_switching_clientes_vip_back_on_shows_the_marks_stored_meanwhile(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=True)
    customer = _register(client, vip=True)
    set_switches(engine, bulk=False, vip=False)
    client.patch(f"/customers/{customer['id']}", json={"vip": False, "name": "Fran B"})

    set_switches(engine, bulk=False, vip=True)

    assert client.get(f"/customers/{customer['id']}").json()["vip"] is True
    edited = client.patch(f"/customers/{customer['id']}", json={"vip": False})
    assert edited.json()["vip"] is False


def test_one_business_s_clientes_vip_switch_never_gates_another_business(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=False, business_name="Primer Negocio")
    set_switches(engine, bulk=False, vip=True, business_name="Otro Negocio")

    assert _register(client, vip=True)["vip"] is False
    assert _register(other_client, vip=True)["vip"] is True
