"""Recording, editing, deleting and listing expenses through the HTTP API, over a
real database (CODING_STANDARDS §5)."""

from datetime import timedelta
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import MovableClock

TODAY = "2026-10-02"


def _category_id(client: TestClient, name: str = "Otros") -> int:
    category = next(c for c in client.get("/expense-categories").json() if c["name"] == name)
    return int(category["id"])


def _record(client: TestClient, **overrides: Any) -> dict[str, Any]:
    category_id = overrides.pop("category_id", None) or _category_id(client)
    body = {
        "spent_on": TODAY,
        "category_id": category_id,
        "amount": 1_000,
        "detail": "fletes de octubre",
    }
    body.update(overrides)
    response = client.post("/expenses", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def test_an_expense_is_recorded(client: TestClient) -> None:
    expense = _record(client)

    assert expense["spent_on"] == TODAY
    assert expense["amount"] == 1_000
    assert expense["detail"] == "fletes de octubre"
    assert "recorded_at" not in expense


def test_a_future_date_is_refused(client: TestClient) -> None:
    response = client.post(
        "/expenses",
        json={
            "spent_on": "2026-10-03",
            "category_id": _category_id(client),
            "amount": 1_000,
            "detail": "algo",
        },
    )

    assert response.status_code == 422


def test_an_unknown_category_id_is_not_found(client: TestClient) -> None:
    response = client.post(
        "/expenses",
        json={"spent_on": TODAY, "category_id": 999_999, "amount": 1_000, "detail": "algo"},
    )

    assert response.status_code == 404


def test_another_businesss_category_id_is_not_found_when_recording(
    client: TestClient, other_client: TestClient
) -> None:
    foreign_category = _category_id(other_client)

    response = client.post(
        "/expenses",
        json={"spent_on": TODAY, "category_id": foreign_category, "amount": 1_000, "detail": "x"},
    )

    assert response.status_code == 404


def test_an_expense_is_edited_in_place(client: TestClient) -> None:
    expense = _record(client)
    other_category = _category_id(client, "Packaging")

    edited = client.put(
        f"/expenses/{expense['id']}",
        json={
            "spent_on": TODAY,
            "category_id": other_category,
            "amount": 2_000,
            "detail": "cambiado",
        },
    )

    assert edited.status_code == 200
    body = edited.json()
    assert body["amount"] == 2_000
    assert body["detail"] == "cambiado"
    assert body["category_id"] == other_category


def test_editing_an_unknown_expense_is_not_found(client: TestClient) -> None:
    response = client.put(
        "/expenses/999999",
        json={"spent_on": TODAY, "category_id": _category_id(client), "amount": 1, "detail": "x"},
    )

    assert response.status_code == 404


def test_another_businesss_expense_id_is_not_found_on_edit_or_delete(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = _record(other_client)

    edited = client.put(
        f"/expenses/{foreign['id']}",
        json={"spent_on": TODAY, "category_id": _category_id(client), "amount": 1, "detail": "x"},
    )
    deleted = client.delete(f"/expenses/{foreign['id']}")

    assert edited.status_code == 404
    assert deleted.status_code == 404


def test_an_expense_is_deleted(client: TestClient) -> None:
    expense = _record(client)

    deleted = client.delete(f"/expenses/{expense['id']}")

    assert deleted.status_code == 204
    assert client.get("/expenses").json()["total"] == 0


def test_deleting_an_unknown_expense_is_not_found(client: TestClient) -> None:
    assert client.delete("/expenses/999999").status_code == 404


def test_the_monthly_view_defaults_to_the_current_argentina_month(client: TestClient) -> None:
    _record(client, amount=500)

    view = client.get("/expenses")

    assert view.status_code == 200
    assert view.json()["month"] == "2026-10"
    assert view.json()["total"] == 500


def test_a_month_with_no_expenses_has_a_zero_total_and_no_categories(client: TestClient) -> None:
    view = client.get("/expenses?month=2026-01")

    assert view.status_code == 200
    assert view.json() == {"month": "2026-01", "total": 0, "categories": []}


def test_a_badly_formed_month_is_refused(client: TestClient) -> None:
    assert client.get("/expenses?month=2026-1").status_code == 422


def test_the_total_and_subtotal_hold_after_an_edit_and_a_delete(client: TestClient) -> None:
    otros = _category_id(client, "Otros")
    packaging = _category_id(client, "Packaging")
    first = _record(client, category_id=otros, amount=100)
    second = _record(client, category_id=packaging, amount=200)

    client.put(
        f"/expenses/{first['id']}",
        json={"spent_on": TODAY, "category_id": otros, "amount": 300, "detail": "cambiado"},
    )
    client.delete(f"/expenses/{second['id']}")

    view = client.get("/expenses").json()
    assert view["total"] == 300
    assert [c["name"] for c in view["categories"]] == ["Otros"]
    assert view["categories"][0]["subtotal"] == 300


def test_expenses_within_a_category_are_ordered_newest_date_first(client: TestClient) -> None:
    otros = _category_id(client, "Otros")
    older = client.post(
        "/expenses",
        json={"spent_on": "2026-10-01", "category_id": otros, "amount": 10, "detail": "a"},
    ).json()
    newer = client.post(
        "/expenses",
        json={"spent_on": "2026-10-02", "category_id": otros, "amount": 20, "detail": "b"},
    ).json()

    view = client.get("/expenses").json()
    ids = [e["id"] for e in view["categories"][0]["expenses"]]
    assert ids == [newer["id"], older["id"]]


def test_on_the_same_date_the_most_recently_recorded_comes_first(
    client: TestClient, clock: MovableClock
) -> None:
    """`recorded_at` and `id` are put in conflict on purpose: A is recorded later by
    the clock but gets the lower id, B is recorded earlier by the clock but gets the
    higher id. Only `recorded_at DESC` can produce the expected order; `id DESC` alone
    would list B first."""
    otros = _category_id(client, "Otros")
    original = clock()
    clock.set(original + timedelta(minutes=5))
    recorded_later_lower_id = client.post(
        "/expenses",
        json={"spent_on": TODAY, "category_id": otros, "amount": 10, "detail": "a"},
    ).json()
    clock.set(original)
    recorded_earlier_higher_id = client.post(
        "/expenses",
        json={"spent_on": TODAY, "category_id": otros, "amount": 20, "detail": "b"},
    ).json()
    assert recorded_earlier_higher_id["id"] > recorded_later_lower_id["id"]

    view = client.get("/expenses").json()
    ids = [e["id"] for e in view["categories"][0]["expenses"]]
    assert ids == [recorded_later_lower_id["id"], recorded_earlier_higher_id["id"]]


def test_editing_with_another_businesss_category_id_is_not_found(
    client: TestClient, other_client: TestClient
) -> None:
    expense = _record(client)
    foreign_category = _category_id(other_client)

    edited = client.put(
        f"/expenses/{expense['id']}",
        json={
            "spent_on": TODAY,
            "category_id": foreign_category,
            "amount": 9_999,
            "detail": "no debería pasar",
        },
    )

    assert edited.status_code == 404
    view = client.get("/expenses").json()
    stored = next(
        e for c in view["categories"] for e in c["expenses"] if e["id"] == expense["id"]
    )
    assert stored["amount"] == expense["amount"]
    assert stored["detail"] == expense["detail"]
    assert stored["category_id"] == expense["category_id"]


def test_refusal_bodies_carry_the_rule_s_code(client: TestClient) -> None:
    """One behaviour test per code family of this capability (docs/adr/0007)."""
    response = client.post(
        "/expenses",
        json={
            "spent_on": TODAY,
            "category_id": _category_id(client),
            "amount": 0,
            "detail": "algo",
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "expense.amount_invalid"
