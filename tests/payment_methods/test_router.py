"""`/api/payment-methods/*` and the places a method is chosen (docs/adr/0076), through
`TestClient` with the real adapters: the archive/delete matrix, a rename showing in every
display, an unavailable method committing nothing, the figures not depending on a method,
and a business that keeps only a method of its own."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.contract_shapes import assert_matches_fixture

URL = "/api/payment-methods"
TODAY = "2026-10-02"  # tests/conftest.py's own TODAY


def _methods(client: TestClient, suffix: str = "") -> list[dict[str, Any]]:
    answer = client.get(URL + suffix)
    assert answer.status_code == 200, answer.text
    body: list[dict[str, Any]] = answer.json()
    return body


def _by_name(client: TestClient, name: str) -> int:
    return int(next(m["id"] for m in _methods(client) if m["name"] == name))


def _add(client: TestClient, name: str, icon: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"name": name}
    if icon is not None:
        body["icon"] = icon
    answer = client.post(URL, json=body)
    assert answer.status_code == 201, answer.text
    created: dict[str, Any] = answer.json()
    return created


def _variety(client: TestClient, price: int = 1_000) -> int:
    variety = client.post("/api/products", json={"name": "Variety"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": price},
    )
    return int(variety["id"])


def _customer(client: TestClient) -> int:
    return int(
        client.post("/customers", json={"name": "Ana", "phone": "11 2000-0000"}).json()["id"]
    )


def _sale(client: TestClient, variety_id: int, payment: Any, **extra: Any) -> Any:
    return client.post(
        "/sales",
        json={"payment": payment, "lines": [{"product_id": variety_id, "quantity": "1"}], **extra},
    )


def _pay(client: TestClient, customer_id: int, method_id: int, amount: int = 400) -> Any:
    return client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": TODAY, "amount": amount, "payment_method_id": method_id},
    )


def _owing_sale(client: TestClient, variety_id: int, customer_id: int) -> int:
    answer = _sale(client, variety_id, {"kind": "owing"}, customer_id=customer_id)
    assert answer.status_code == 201, answer.text
    return int(answer.json()["id"])


# -- the starting list and its shape -------------------------------------------------------


def test_a_business_starts_with_cash_and_transfer_in_that_order(client: TestClient) -> None:
    listed = _methods(client)

    assert [(m["name"], m["icon"], m["is_used"]) for m in listed] == [
        ("Cash", "coins", False),
        ("Transfer", "bank", False),
    ]
    assert_matches_fixture(listed, "payment-methods")


def test_a_new_method_goes_last_with_the_generic_icon_and_a_trimmed_name(
    client: TestClient,
) -> None:
    created = _add(client, "  Mercado Pago  ")

    assert (created["name"], created["icon"]) == ("Mercado Pago", "generic")
    assert [m["name"] for m in _methods(client)] == ["Cash", "Transfer", "Mercado Pago"]


def test_move_up_swaps_a_method_with_its_neighbour(client: TestClient) -> None:
    transfer = _by_name(client, "Transfer")

    moved = client.post(f"{URL}/{transfer}/move", json={"direction": "up"})

    assert [m["name"] for m in moved.json()] == ["Transfer", "Cash"]
    assert [m["name"] for m in _methods(client)] == ["Transfer", "Cash"]


# -- the name rules ------------------------------------------------------------------------


def test_an_empty_name_is_refused_with_its_own_code(client: TestClient) -> None:
    answer = client.post(URL, json={"name": "   "})

    assert answer.status_code == 422
    assert answer.json()["code"] == "payment_method.name_empty"


def test_a_41_character_name_is_refused_and_40_is_taken(client: TestClient) -> None:
    refused = client.post(URL, json={"name": "x" * 41})
    taken = client.post(URL, json={"name": "x" * 40})

    assert (refused.status_code, refused.json()["code"]) == (422, "payment_method.name_too_long")
    assert taken.status_code == 201


def test_a_duplicate_name_ignoring_case_and_spaces_is_refused(client: TestClient) -> None:
    answer = client.post(URL, json={"name": " CASH "})

    assert (answer.status_code, answer.json()["code"]) == (422, "payment_method.name_taken")


def test_an_archived_method_still_reserves_its_name(client: TestClient) -> None:
    transfer = _by_name(client, "Transfer")
    assert client.post(f"{URL}/{transfer}/archive").status_code == 204

    answer = client.post(URL, json={"name": "transfer"})

    assert (answer.status_code, answer.json()["code"]) == (422, "payment_method.name_taken")


def test_renaming_to_another_methods_name_is_refused(client: TestClient) -> None:
    transfer = _by_name(client, "Transfer")

    answer = client.patch(f"{URL}/{transfer}", json={"name": "cash"})

    assert (answer.status_code, answer.json()["code"]) == (422, "payment_method.name_taken")


# -- archive, restore, delete ---------------------------------------------------------------


def test_an_unused_method_is_deleted_for_good(client: TestClient) -> None:
    extra = _add(client, "Wallet")

    assert client.delete(f"{URL}/{extra['id']}").status_code == 204
    assert [m["name"] for m in _methods(client)] == ["Cash", "Transfer"]
    assert _methods(client, "/archived") == []


def test_a_method_in_use_cannot_be_deleted_and_can_be_archived_then_restored_in_place(
    client: TestClient,
) -> None:
    cash = _by_name(client, "Cash")
    customer = _customer(client)
    variety = _variety(client)
    _owing_sale(client, variety, customer)
    assert _pay(client, customer, cash).status_code == 201
    assert next(m for m in _methods(client) if m["id"] == cash)["is_used"] is True

    refused = client.delete(f"{URL}/{cash}")
    archived = client.post(f"{URL}/{cash}/archive")

    assert (refused.status_code, refused.json()["code"]) == (409, "payment_method.in_use")
    assert archived.status_code == 204
    assert [m["name"] for m in _methods(client)] == ["Transfer"]
    assert [m["name"] for m in _methods(client, "/archived")] == ["Cash"]

    assert client.post(f"{URL}/{cash}/restore").status_code == 204
    assert [m["name"] for m in _methods(client)] == ["Cash", "Transfer"]
    assert _methods(client, "/archived") == []


def test_the_last_active_method_cannot_be_archived_or_deleted(client: TestClient) -> None:
    cash = _by_name(client, "Cash")
    assert client.delete(f"{URL}/{_by_name(client, 'Transfer')}").status_code == 204

    archive = client.post(f"{URL}/{cash}/archive")
    delete = client.delete(f"{URL}/{cash}")

    assert (archive.status_code, archive.json()["code"]) == (409, "payment_method.last_active")
    assert (delete.status_code, delete.json()["code"]) == (409, "payment_method.last_active")
    assert [m["name"] for m in _methods(client)] == ["Cash"]


def test_an_unknown_method_answers_404_on_every_route(client: TestClient) -> None:
    answers = [
        client.patch(f"{URL}/9999", json={"name": "X"}),
        client.post(f"{URL}/9999/move", json={"direction": "up"}),
        client.post(f"{URL}/9999/archive"),
        client.post(f"{URL}/9999/restore"),
        client.delete(f"{URL}/9999"),
    ]

    assert [a.status_code for a in answers] == [404] * 5
    assert {a.json()["code"] for a in answers} == {"payment_method.not_found"}


def test_another_business_s_method_answers_404_and_stays_untouched(
    client: TestClient, other_client: TestClient
) -> None:
    theirs = _by_name(other_client, "Cash")

    answers = [
        client.patch(f"{URL}/{theirs}", json={"name": "Mine"}),
        client.post(f"{URL}/{theirs}/archive"),
        client.delete(f"{URL}/{theirs}"),
    ]

    assert [a.status_code for a in answers] == [404] * 3
    assert [m["name"] for m in _methods(other_client)] == ["Cash", "Transfer"]


# -- a rename shows everywhere, the payment itself unchanged ---------------------------------


def test_a_rename_shows_in_the_sale_the_account_and_the_bill_and_changes_no_payment(
    client: TestClient,
) -> None:
    cash = _by_name(client, "Cash")
    variety = _variety(client)
    customer = _customer(client)
    sale = _sale(client, variety, {"kind": "method", "payment_method_id": cash})
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["id"]
    owing = _owing_sale(client, variety, customer)
    later = _pay(client, customer, cash)
    assert later.status_code == 201, later.text
    before = client.get(f"/customers/{customer}/account").json()

    assert (
        client.patch(f"{URL}/{cash}", json={"name": "Efectivo", "icon": "wallet"}).status_code
        == 200
    )

    detail = client.get(f"/sales/{sale_id}").json()
    assert detail["payment"] == {
        "kind": "method",
        "payment_method_id": cash,
        "name": "Efectivo",
        "icon": "wallet",
    }
    assert detail["bill"]["payment"]["method_name"] == "Efectivo"
    after = client.get(f"/customers/{customer}/account").json()
    payments = [r["payment"] for r in after["rows"] if r["kind"] == "payment"]
    assert [(p["name"], p["icon"], p["payment_method_id"]) for p in payments] == [
        ("Efectivo", "wallet", cash)
    ]
    old = [r["payment"] for r in before["rows"] if r["kind"] == "payment"][0]
    assert {k: payments[0][k] for k in ("id", "paid_on", "amount")} == {
        k: old[k] for k in ("id", "paid_on", "amount")
    }
    assert after["balance"] == before["balance"]
    assert owing != sale_id


def test_an_archived_method_still_shows_its_plain_name_on_a_recorded_sale(
    client: TestClient,
) -> None:
    wallet = _add(client, "Wallet", "wallet")["id"]
    sale = _sale(client, _variety(client), {"kind": "method", "payment_method_id": wallet})
    sale_id = sale.json()["id"]
    assert client.post(f"{URL}/{wallet}/archive").status_code == 204

    detail = client.get(f"/sales/{sale_id}").json()

    assert detail["payment"]["name"] == "Wallet"
    listed = client.get("/sales").json()
    assert "Wallet" in str(listed)


# -- an unavailable method commits nothing ---------------------------------------------------


def test_an_archived_or_foreign_method_in_a_sale_answers_404_and_records_nothing(
    client: TestClient, other_client: TestClient
) -> None:
    variety = _variety(client)
    wallet = _add(client, "Wallet")["id"]
    assert client.post(f"{URL}/{wallet}/archive").status_code == 204
    foreign = _by_name(other_client, "Cash")
    before = client.get("/sales").json()

    for method_id in (wallet, foreign, 9999):
        answer = _sale(client, variety, {"kind": "method", "payment_method_id": method_id})
        assert answer.status_code == 404, answer.text
        assert answer.json()["code"] == "payment_method.unavailable"

    assert client.get("/sales").json() == before


def test_an_archived_or_foreign_method_in_a_payment_answers_404_and_records_nothing(
    client: TestClient, other_client: TestClient
) -> None:
    customer = _customer(client)
    _owing_sale(client, _variety(client), customer)
    wallet = _add(client, "Wallet")["id"]
    assert client.post(f"{URL}/{wallet}/archive").status_code == 204
    foreign = _by_name(other_client, "Cash")
    before = client.get(f"/customers/{customer}/account").json()

    for method_id in (wallet, foreign):
        answer = _pay(client, customer, method_id)
        assert answer.status_code == 404, answer.text
        assert answer.json()["code"] == "payment_method.unavailable"

    assert client.get(f"/customers/{customer}/account").json() == before


# -- figures do not depend on a method -------------------------------------------------------


def _figures(client: TestClient, method_id: int) -> tuple[Any, ...]:
    variety = _variety(client, price=2_000)
    customer = _customer(client)
    assert (
        _sale(client, variety, {"kind": "method", "payment_method_id": method_id}).status_code
        == 201
    )
    _owing_sale(client, variety, customer)
    assert _pay(client, customer, method_id, amount=700).status_code == 201
    panel = client.get("/panel").json()
    account = client.get(f"/customers/{customer}/account").json()
    return (
        panel["periods"]["today"]["cash"],
        panel["periods"]["today"]["sales"],
        panel["debts"]["total_owed"],
        account["balance"],
        account["owing_since"],
    )


def test_figures_are_identical_with_a_default_method_and_a_custom_one(
    client: TestClient, other_client: TestClient
) -> None:
    with_default = _figures(client, _by_name(client, "Cash"))
    with_custom = _figures(other_client, _add(other_client, "Mercado Pago", "phone")["id"])

    assert with_custom == with_default


# -- Assume nothing: a business that keeps only its own method -------------------------------


def test_a_business_with_only_its_own_method_records_a_paid_sale_and_a_later_payment(
    client: TestClient,
) -> None:
    own = _add(client, "Mercado Pago", "phone")["id"]
    for name in ("Cash", "Transfer"):
        assert client.delete(f"{URL}/{_by_name(client, name)}").status_code == 204
    variety = _variety(client)
    customer = _customer(client)

    paid = _sale(client, variety, {"kind": "method", "payment_method_id": own})
    _owing_sale(client, variety, customer)
    later = _pay(client, customer, own, amount=1_000)

    assert paid.status_code == 201, paid.text
    assert later.status_code == 201, later.text
    assert client.get(f"/customers/{customer}/account").json()["balance"] == 0
