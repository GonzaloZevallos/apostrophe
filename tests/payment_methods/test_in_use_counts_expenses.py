"""A payment method is in use when any Payment or any Expense of the business points at it
(docs/adr/20261124-a-payment-method-is-in-use-when-any-payment-or-expense-points-at-it),
through the HTTP API over a real database.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

METHODS = "/api/payment-methods"
IN_USE = "payment_method.in_use"
LAST_OFFERED = "payment_method.last_offered"


class NothingInUse:
    """A usage that never sees a record: what a race looks like to the use case."""

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]:
        return frozenset()


def _nothing_in_use(session: object, business_id: int) -> NothingInUse:
    return NothingInUse()


def _new_method(client: TestClient, name: str) -> int:
    response = client.post(METHODS, json={"name": name})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _cash(client: TestClient) -> int:
    return int(next(m["id"] for m in client.get(METHODS).json() if m["name"] == "Cash"))


def _expense(client: TestClient, method_id: int | None) -> dict[str, Any]:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == "Other")
    response = client.post(
        "/expenses",
        json={
            "spent_on": "2026-10-02",
            "category_id": category["id"],
            "amount": 1_000,
            "detail": "fletes",
            "payment_method_id": method_id,
        },
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def _payment(client: TestClient, method_id: int) -> None:
    product = client.post("/api/products", json={"name": f"Lavanda {method_id}"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    response = client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": method_id},
            "lines": [{"product_id": product["id"], "quantity": "1"}],
        },
    )
    assert response.status_code == 201, response.text


def _in_use(client: TestClient, method_id: int, path: str = METHODS) -> bool:
    listed = client.get(path).json()
    return bool(next(m["in_use"] for m in listed if m["id"] == method_id))


def test_a_method_a_record_points_at_is_in_use_and_refuses_delete_with_one_body(
    client: TestClient,
) -> None:
    refusals: dict[str, bytes] = {}
    for users in ("payments", "expenses", "both"):
        method = _new_method(client, f"Method {users}")
        if users != "expenses":
            _payment(client, method)
        if users != "payments":
            _expense(client, method)

        assert _in_use(client, method)
        refused = client.delete(f"{METHODS}/{method}")
        assert refused.status_code == 409
        assert refused.json()["code"] == IN_USE
        refusals[users] = refused.content

    assert len(set(refusals.values())) == 1, refusals


def test_a_method_nothing_points_at_is_not_in_use_and_can_be_deleted(client: TestClient) -> None:
    method = _new_method(client, "Visa")
    _expense(client, None)

    assert not any(m["in_use"] for m in client.get(METHODS).json())
    assert client.delete(f"{METHODS}/{method}").status_code == 204


def test_an_archived_method_used_only_by_an_expense_is_in_use_and_cannot_be_deleted(
    client: TestClient,
) -> None:
    method = _new_method(client, "Old")
    _expense(client, method)
    assert client.post(f"{METHODS}/{method}/archive").status_code == 204

    assert _in_use(client, method, f"{METHODS}/archived")
    refused = client.delete(f"{METHODS}/{method}")
    assert refused.status_code == 409
    assert refused.json()["code"] == IN_USE


def test_the_only_offered_method_used_by_an_expense_still_answers_last_offered(
    client: TestClient,
) -> None:
    cash = _cash(client)
    transfer = next(m["id"] for m in client.get(METHODS).json() if m["name"] == "Transfer")
    assert client.post(f"{METHODS}/{transfer}/archive").status_code == 204
    _expense(client, cash)

    refused = client.delete(f"{METHODS}/{cash}")

    assert refused.status_code == 409
    assert refused.json()["code"] == LAST_OFFERED


@pytest.mark.parametrize("archived", [False, True])
def test_a_record_written_after_the_check_is_refused_as_in_use_by_the_delete_itself(
    client: TestClient, app: FastAPI, archived: bool
) -> None:
    """The use case's check answers "nothing in use": the foreign key is the backstop,
    and it answers the same 409 body, never a 500, and the method stays."""
    method = _new_method(client, "Raced")
    _expense(client, method)
    if archived:
        assert client.post(f"{METHODS}/{method}/archive").status_code == 204
    honest = client.delete(f"{METHODS}/{method}")
    assert honest.status_code == 409

    app.state.payment_method_usage = _nothing_in_use
    raced = client.delete(f"{METHODS}/{method}")

    assert raced.status_code == 409
    assert raced.content == honest.content
    assert raced.json()["code"] == IN_USE
    listed = client.get(f"{METHODS}/archived" if archived else METHODS).json()
    assert method in [m["id"] for m in listed]


def test_an_expense_keeps_its_method_id_and_shows_the_new_name_after_a_rename_and_archive(
    client: TestClient,
) -> None:
    method = _new_method(client, "Visa")
    recorded = _expense(client, method)
    assert recorded["payment_method"]["id"] == method
    assert client.patch(f"{METHODS}/{method}", json={"name": "Visa Debito"}).status_code == 200
    assert client.post(f"{METHODS}/{method}/archive").status_code == 204

    view = client.get("/expenses", params={"month": "2026-10"}).json()
    listed = [e for category in view["categories"] for e in category["expenses"]]

    assert [e["payment_method"] for e in listed] == [
        {"id": method, "name": "Visa Debito", "icon": "other"}
    ]
