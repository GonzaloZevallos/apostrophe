"""An expense's Payment method through the HTTP API, over a real database
(docs/product/expenses.md: Datos y API; docs/adr/20261111-payment-methods-by-id).

The method is optional, comes back as `payment_method {id, name, icon}` with its current
name, and is checked inside the write: every method the business does not offer now
answers the same 404 `payment_method.unavailable`, byte for byte.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlalchemy import text
from sqlalchemy.engine import Engine

TODAY = "2026-10-02"
METHODS = "/api/payment-methods"
UNAVAILABLE = ["archived", "deleted", "unknown", "other_business", "zero", "negative"]


def _category_id(client: TestClient, name: str = "Other") -> int:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == name)
    return int(category["id"])


def _method(client: TestClient, name: str) -> int:
    return int(next(m["id"] for m in client.get(METHODS).json() if m["name"] == name))


def _body(client: TestClient, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "spent_on": TODAY,
        "category_id": _category_id(client),
        "amount": 1_000,
        "detail": "fletes",
    }
    body.update(overrides)
    return body


def _post(client: TestClient, **overrides: Any) -> Response:
    return client.post("/expenses", json=_body(client, **overrides))


def _record(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = _post(client, **overrides)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def _listed(client: TestClient) -> list[dict[str, Any]]:
    view = client.get("/expenses", params={"month": "2026-10"}).json()
    return [e for category in view["categories"] for e in category["expenses"]]


def _archived(client: TestClient, name: str = "Old") -> int:
    method = int(client.post(METHODS, json={"name": name}).json()["id"])
    assert client.post(f"{METHODS}/{method}/archive").status_code == 204
    return method


def _unusable(kind: str, client: TestClient, other_client: TestClient) -> int:
    if kind == "archived":
        return _archived(client)
    if kind == "deleted":
        method = int(client.post(METHODS, json={"name": "Gone"}).json()["id"])
        assert client.delete(f"{METHODS}/{method}").status_code == 204
        return method
    if kind == "unknown":
        return 999_999
    if kind == "zero":
        return 0
    if kind == "negative":
        return -5
    return _method(other_client, "Cash")


def test_an_expense_with_an_offered_method_returns_it_on_the_write_and_the_monthly_read(
    client: TestClient,
) -> None:
    cash = _method(client, "Cash")

    expense = _record(client, payment_method_id=cash)

    label = {"id": cash, "name": "Cash", "icon": "banknote"}
    assert expense["payment_method"] == label
    assert [e["payment_method"] for e in _listed(client)] == [label]


@pytest.mark.parametrize("missing", [True, False])
def test_an_expense_with_no_method_returns_null(client: TestClient, missing: bool) -> None:
    expense = _record(client) if missing else _record(client, payment_method_id=None)

    assert expense["payment_method"] is None
    assert [e["payment_method"] for e in _listed(client)] == [None]


def test_an_expense_with_a_method_and_one_without_both_appear_in_the_month(
    client: TestClient,
) -> None:
    cash = _method(client, "Cash")
    with_method = _record(client, payment_method_id=cash, detail="con")
    without = _record(client, detail="sin")

    listed = {e["id"]: e["payment_method"] for e in _listed(client)}

    assert listed == {
        with_method["id"]: {"id": cash, "name": "Cash", "icon": "banknote"},
        without["id"]: None,
    }


def test_a_rename_shows_the_new_name_and_an_archive_keeps_the_method(client: TestClient) -> None:
    cash = _method(client, "Cash")
    _record(client, payment_method_id=cash)

    assert client.patch(f"{METHODS}/{cash}", json={"name": "Efectivo"}).status_code == 200
    assert [e["payment_method"]["name"] for e in _listed(client)] == ["Efectivo"]

    assert client.post(f"{METHODS}/{cash}/archive").status_code == 204
    assert [e["payment_method"]["id"] for e in _listed(client)] == [cash]


@pytest.mark.parametrize("kind", UNAVAILABLE)
def test_a_post_with_an_unusable_method_answers_the_same_404_and_writes_nothing(
    kind: str, client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    method = _unusable(kind, client, other_client)
    reference = _post(client, payment_method_id=999_999)

    refused = _post(client, payment_method_id=method)

    assert refused.status_code == 404
    assert refused.json()["code"] == "payment_method.unavailable"
    assert refused.content == reference.content
    assert _listed(client) == []
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM expense")).scalar_one() == 0


def test_the_expenses_404_for_id_zero_is_the_payments_404_for_id_zero(
    client: TestClient,
) -> None:
    customer = client.post(
        "/customers", json={"name": "Ana", "phone": "11 2000-0000", "phone_country": "AR"}
    ).json()
    payments = client.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": TODAY, "amount": 1_000, "payment_method_id": 0},
    )

    expenses = _post(client, payment_method_id=0)

    assert expenses.status_code == payments.status_code == 404
    assert expenses.content == payments.content


def test_id_zero_beats_an_invalid_detail_and_an_unavailable_id_does_not(
    client: TestClient,
) -> None:
    long_detail = "x" * 201

    zero = _post(client, payment_method_id=0, detail=long_detail)
    unavailable = _post(client, payment_method_id=999_999, detail=long_detail)

    assert zero.status_code == 404
    assert zero.json()["code"] == "payment_method.unavailable"
    assert unavailable.status_code == 422
    assert unavailable.json()["code"] == "expense.detail_invalid"


def test_a_put_to_another_archived_method_answers_404_and_changes_nothing(
    client: TestClient,
) -> None:
    cash = _method(client, "Cash")
    expense = _record(client, payment_method_id=cash)
    archived = _archived(client)

    refused = client.put(
        f"/expenses/{expense['id']}",
        json=_body(client, payment_method_id=archived, detail="edited"),
    )

    assert refused.status_code == 404
    assert refused.json()["code"] == "payment_method.unavailable"
    assert _listed(client) == [expense]


def test_a_put_resending_its_own_now_archived_method_keeps_it(client: TestClient) -> None:
    method = int(client.post(METHODS, json={"name": "Later"}).json()["id"])
    expense = _record(client, payment_method_id=method)
    assert client.post(f"{METHODS}/{method}/archive").status_code == 204

    edited = client.put(
        f"/expenses/{expense['id']}",
        json=_body(client, payment_method_id=method, detail="edited"),
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["payment_method"]["id"] == method
    assert edited.json()["detail"] == "edited"


@pytest.mark.parametrize("keyed", [True, False])
def test_a_put_with_null_or_without_the_key_removes_the_method(
    client: TestClient, keyed: bool
) -> None:
    expense = _record(client, payment_method_id=_method(client, "Cash"))
    body = _body(client, payment_method_id=None) if keyed else _body(client)

    edited = client.put(f"/expenses/{expense['id']}", json=body)

    assert edited.status_code == 200, edited.text
    assert edited.json()["payment_method"] is None
    assert [e["payment_method"] for e in _listed(client)] == [None]


def test_a_missing_detail_is_recorded_as_the_empty_string(client: TestClient) -> None:
    body = _body(client)
    del body["detail"]

    response = client.post("/expenses", json=body)

    assert response.status_code == 201, response.text
    assert response.json()["detail"] == ""


def test_a_blank_detail_is_recorded_as_the_empty_string(client: TestClient) -> None:
    assert _record(client, detail="   ")["detail"] == ""


def test_a_null_detail_answers_422(client: TestClient) -> None:
    assert _post(client, detail=None).status_code == 422


def test_a_detail_of_201_characters_answers_422_detail_invalid(client: TestClient) -> None:
    refused = _post(client, detail="x" * 201)

    assert refused.status_code == 422
    assert refused.json()["code"] == "expense.detail_invalid"


def test_another_businesss_put_on_an_expense_is_not_found(
    client: TestClient, other_client: TestClient
) -> None:
    expense = _record(client, payment_method_id=_method(client, "Cash"))

    refused = other_client.put(
        f"/expenses/{expense['id']}",
        json=_body(other_client, payment_method_id=_method(other_client, "Cash")),
    )

    assert refused.status_code == 404
    assert refused.json()["code"] == "expense.not_found"


def test_a_put_answers_what_is_stored_not_what_the_session_held(
    client: TestClient, engine: Engine
) -> None:
    """Stale-read pin: the PUT's response, the monthly read and the stored row agree."""
    expense = _record(client, payment_method_id=_method(client, "Cash"))
    transfer = _method(client, "Transfer")
    other_category = _category_id(client, "Packaging")

    edited = client.put(
        f"/expenses/{expense['id']}",
        json=_body(
            client,
            category_id=other_category,
            spent_on="2026-10-01",
            detail="otro",
            payment_method_id=transfer,
            amount=2_500,
        ),
    )

    assert edited.status_code == 200, edited.text
    assert _listed(client) == [edited.json()]
    with engine.connect() as connection:
        stored = connection.execute(
            text(
                "SELECT payment_method_id, expense_category_id, spent_on, detail "
                "FROM expense WHERE id = :id"
            ),
            {"id": expense["id"]},
        ).one()
    assert tuple(stored) == (transfer, other_category, "2026-10-01", "otro")
