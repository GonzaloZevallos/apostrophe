"""Expense categories through the HTTP API, over a real database."""

from datetime import UTC, date, datetime
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.tables import ExpenseRow
from tests.conftest import PASSWORD

DEFAULTS = ["Growing supplies", "Other", "Packaging", "Shipping and transport"]


def _names(client: TestClient) -> list[str]:
    return [c["name"] for c in client.get("/expense-categories").json()]


def _add(client: TestClient, name: str) -> dict[str, Any]:
    response = client.post("/expense-categories", json={"name": name})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_new_business_opens_with_the_four_defaults_sorted_by_name(client: TestClient) -> None:
    assert _names(client) == DEFAULTS


def test_accepting_a_join_invitation_adds_no_categories(
    client: TestClient, anonymous_client: TestClient
) -> None:
    issued = client.post("/invitations")
    token = issued.json()["url"].rsplit("/", 1)[-1]

    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"email": "socio@example.com", "password": PASSWORD, "business_name": "Ignored"},
    )

    assert accepted.status_code == 201
    assert _names(anonymous_client) == DEFAULTS


def test_a_category_is_added(client: TestClient) -> None:
    category = _add(client, "  Fletes   especiales ")

    assert category["name"] == "Fletes especiales"
    assert "Fletes especiales" in _names(client)


def test_a_duplicate_name_is_refused_whatever_the_case_or_spacing(client: TestClient) -> None:
    _add(client, "Fletes")

    response = client.post("/expense-categories", json={"name": "  fletes  "})

    assert response.status_code == 409
    assert "Fletes" not in response.text


def test_a_category_is_renamed(client: TestClient) -> None:
    category = _add(client, "Fletes")

    renamed = client.patch(f"/expense-categories/{category['id']}", json={"name": "Envíos"})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Envíos"


def test_renaming_to_another_categorys_name_is_refused(client: TestClient) -> None:
    first = _add(client, "Fletes")
    _add(client, "Envíos")

    response = client.patch(f"/expense-categories/{first['id']}", json={"name": "ENVÍOS"})

    assert response.status_code == 409
    assert "Envíos" not in response.text


def test_renaming_to_its_own_name_with_different_case_is_allowed(client: TestClient) -> None:
    category = _add(client, "Fletes")

    renamed = client.patch(f"/expense-categories/{category['id']}", json={"name": "FLETES"})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "FLETES"


def test_an_unused_category_is_removable_defaults_included(client: TestClient) -> None:
    categories = client.get("/expense-categories").json()
    otros = next(c for c in categories if c["name"] == "Other")

    removed = client.delete(f"/expense-categories/{otros['id']}")

    assert removed.status_code == 204
    assert "Other" not in _names(client)


def test_removing_every_category_then_opening_another_business_leaves_the_first_empty(
    client: TestClient, other_client: TestClient
) -> None:
    for category in client.get("/expense-categories").json():
        assert client.delete(f"/expense-categories/{category['id']}").status_code == 204

    assert _names(client) == []
    assert _names(other_client) == DEFAULTS
    assert _names(client) == []


def test_another_businesss_category_id_is_not_found_on_rename_or_remove(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = client.get("/expense-categories").json()[0]["id"]

    assert other_client.patch(
        f"/expense-categories/{foreign}", json={"name": "Mina"}
    ).status_code == 404
    assert other_client.delete(f"/expense-categories/{foreign}").status_code == 404


def test_removing_a_category_with_a_filed_expense_is_refused_until_it_has_none(
    client: TestClient, engine: Engine
) -> None:
    # Recording an expense is the next subtask's route; here the row is inserted
    # directly, the same as the repository seam test, to exercise this subtask's own
    # 409 translation over HTTP.
    category = _add(client, "Fletes")
    with Session(engine) as session:
        expense = ExpenseRow(
            business_id=1,
            category_id=category["id"],
            spent_on=date(2026, 10, 1),
            amount=100,
            detail="una compra",
            recorded_at=datetime(2026, 10, 1, tzinfo=UTC),
        )
        session.add(expense)
        session.commit()
        expense_id = expense.id

    refused = client.delete(f"/expense-categories/{category['id']}")

    assert refused.status_code == 409
    assert refused.json() == {
        "detail": "the category still has expenses and cannot be removed",
        "code": "expense_category.in_use",
    }
    assert "Fletes" not in refused.text

    with Session(engine) as session:
        session.delete(session.get_one(ExpenseRow, expense_id))
        session.commit()

    removed = client.delete(f"/expense-categories/{category['id']}")
    assert removed.status_code == 204


def test_a_bad_name_is_refused_with_no_user_typed_text_in_the_detail(client: TestClient) -> None:
    response = client.post("/expense-categories", json={"name": "x" * 61})

    assert response.status_code == 422
    assert "x" * 61 not in response.text
