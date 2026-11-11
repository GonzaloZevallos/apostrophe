"""The payment methods through the HTTP API, over a real database (docs/adr/0085)."""

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import PASSWORD

PATH = "/api/payment-methods"


def _names(client: TestClient, path: str = PATH) -> list[str]:
    response = client.get(path)
    assert response.status_code == 200, response.text
    return [method["name"] for method in response.json()]


def _add(client: TestClient, name: str, **extra: Any) -> dict[str, Any]:
    response = client.post(PATH, json={"name": name, **extra})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def _id_of(client: TestClient, name: str) -> int:
    found = next(m["id"] for m in client.get(PATH).json() if m["name"] == name)
    assert isinstance(found, int)
    return found


def test_a_new_business_lists_cash_then_transfer(client: TestClient) -> None:
    listed = client.get(PATH).json()

    assert [(m["name"], m["icon"], m["position"], m["in_use"]) for m in listed] == [
        ("Cash", "banknote", 1, False),
        ("Transfer", "bank", 2, False),
    ]


def test_a_business_opened_by_invitation_starts_with_the_two_defaults(
    client: TestClient, anonymous_client: TestClient
) -> None:
    token = client.post("/invitations").json()["url"].rsplit("/", 1)[-1]

    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"email": "socio@example.com", "password": PASSWORD, "business_name": "Otro"},
    )

    assert accepted.status_code == 201
    assert _names(anonymous_client) == ["Cash", "Transfer"]


def test_a_method_is_added_last_trimmed_with_the_default_icon(client: TestClient) -> None:
    method = _add(client, "  Mercado   Pago ")

    assert method["name"] == "Mercado Pago"
    assert method["icon"] == "other"
    assert _names(client) == ["Cash", "Transfer", "Mercado Pago"]


def test_a_blank_name_is_refused(client: TestClient) -> None:
    response = client.post(PATH, json={"name": "  "})

    assert response.status_code == 422
    assert response.json()["code"] == "payment_method.name_required"


def test_sixty_one_characters_are_refused_and_sixty_are_not(client: TestClient) -> None:
    refused = client.post(PATH, json={"name": "x" * 61})

    assert refused.status_code == 422
    assert refused.json()["code"] == "payment_method.name_too_long"
    _add(client, "x" * 60)


def test_an_icon_outside_the_set_is_refused(client: TestClient) -> None:
    assert client.post(PATH, json={"name": "Visa", "icon": "visa"}).status_code == 422


def test_a_name_taken_by_an_offered_method_is_refused_ignoring_case_and_spaces(
    client: TestClient,
) -> None:
    response = client.post(PATH, json={"name": "  CASH "})

    assert response.status_code == 409
    assert response.json()["code"] == "payment_method.name_taken"


def test_a_name_held_by_an_archived_method_is_refused_apart(client: TestClient) -> None:
    extra = _add(client, "Wallet app")
    assert client.post(f"{PATH}/{extra['id']}/archive").status_code == 204

    response = client.post(PATH, json={"name": "wallet   APP"})

    assert response.status_code == 409
    assert response.json()["code"] == "payment_method.name_taken_archived"


def test_rename_and_re_icon(client: TestClient) -> None:
    cash = _id_of(client, "Cash")

    response = client.patch(f"{PATH}/{cash}", json={"name": "Efectivo", "icon": "coins"})

    assert response.status_code == 200
    assert (response.json()["name"], response.json()["icon"]) == ("Efectivo", "coins")
    assert _names(client) == ["Efectivo", "Transfer"]


def test_renaming_to_its_own_name_in_other_case_is_allowed(client: TestClient) -> None:
    cash = _id_of(client, "Cash")

    assert client.patch(f"{PATH}/{cash}", json={"name": "CASH"}).status_code == 200


def test_renaming_onto_another_name_is_refused(client: TestClient) -> None:
    cash = _id_of(client, "Cash")

    response = client.patch(f"{PATH}/{cash}", json={"name": "transfer"})

    assert response.status_code == 409
    assert response.json()["code"] == "payment_method.name_taken"


def test_move_swaps_with_the_neighbour_and_does_nothing_at_an_end(client: TestClient) -> None:
    transfer = _id_of(client, "Transfer")

    moved = client.post(f"{PATH}/{transfer}/move", json={"direction": "up"})
    assert [m["name"] for m in moved.json()] == ["Transfer", "Cash"]
    assert _names(client) == ["Transfer", "Cash"]

    at_the_end = client.post(f"{PATH}/{transfer}/move", json={"direction": "up"})
    assert at_the_end.status_code == 200
    assert _names(client) == ["Transfer", "Cash"]


def test_archive_hides_it_and_restore_returns_it_to_its_own_position(client: TestClient) -> None:
    cash = _id_of(client, "Cash")

    assert client.post(f"{PATH}/{cash}/archive").status_code == 204
    assert _names(client) == ["Transfer"]
    assert _names(client, f"{PATH}/archived") == ["Cash"]

    assert client.post(f"{PATH}/{cash}/restore").status_code == 204
    assert _names(client) == ["Cash", "Transfer"]
    assert _names(client, f"{PATH}/archived") == []


def test_the_last_offered_method_cannot_be_archived_or_deleted(client: TestClient) -> None:
    cash = _id_of(client, "Cash")
    transfer = _id_of(client, "Transfer")
    assert client.post(f"{PATH}/{cash}/archive").status_code == 204

    archived = client.post(f"{PATH}/{transfer}/archive")
    deleted = client.delete(f"{PATH}/{transfer}")

    for refused in (archived, deleted):
        assert refused.status_code == 409
        assert refused.json()["code"] == "payment_method.last_offered"
    assert _names(client) == ["Transfer"]


def test_a_method_is_deleted_for_good(client: TestClient) -> None:
    extra = _add(client, "Barter")

    assert client.delete(f"{PATH}/{extra['id']}").status_code == 204

    assert _names(client) == ["Cash", "Transfer"]
    assert _names(client, f"{PATH}/archived") == []
    assert client.delete(f"{PATH}/{extra['id']}").status_code == 404


def test_an_archived_method_keeps_its_name_reserved_and_can_be_deleted(client: TestClient) -> None:
    extra = _add(client, "Barter")
    client.post(f"{PATH}/{extra['id']}/archive")

    assert client.delete(f"{PATH}/{extra['id']}").status_code == 204
    _add(client, "Barter")


def test_an_unknown_id_answers_404_on_every_route(client: TestClient) -> None:
    gone = {"code": "payment_method.not_found"}
    answers = [
        client.patch(f"{PATH}/999", json={"name": "x"}),
        client.post(f"{PATH}/999/move", json={"direction": "up"}),
        client.post(f"{PATH}/999/archive"),
        client.post(f"{PATH}/999/restore"),
        client.delete(f"{PATH}/999"),
    ]

    for answer in answers:
        assert answer.status_code == 404
        assert answer.json()["code"] == gone["code"]


def test_two_businesses_may_each_have_a_method_with_the_same_name(
    client: TestClient, other_client: TestClient
) -> None:
    _add(client, "Barter")
    _add(other_client, "Barter")

    assert _names(other_client) == ["Cash", "Transfer", "Barter"]
