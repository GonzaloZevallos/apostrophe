"""The withdrawal reasons through the HTTP API, over a real database."""

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import PASSWORD

PATH = "/api/withdrawal-reasons"


def _names(client: TestClient) -> list[str]:
    response = client.get(PATH)
    assert response.status_code == 200, response.text
    return [reason["name"] for reason in response.json()]


def _add(client: TestClient, name: str) -> dict[str, Any]:
    response = client.post(PATH, json={"name": name})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def _id_of(client: TestClient, name: str) -> int:
    found = next(r["id"] for r in client.get(PATH).json() if r["name"] == name)
    assert isinstance(found, int)
    return found


def test_a_new_business_lists_the_two_defaults_in_order(client: TestClient) -> None:
    assert _names(client) == ["Marketing", "Own use"]


def test_a_business_that_joins_by_invitation_adds_no_reasons(
    client: TestClient, anonymous_client: TestClient
) -> None:
    token = client.post("/invitations").json()["url"].rsplit("/", 1)[-1]

    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"email": "socio@example.com", "password": PASSWORD, "business_name": "Ignored"},
    )

    assert accepted.status_code == 201
    assert _names(anonymous_client) == ["Marketing", "Own use"]


def test_a_reason_is_added_at_the_end_trimmed_and_collapsed(client: TestClient) -> None:
    reason = _add(client, "  Regalos   a clientes ")

    assert reason["name"] == "Regalos a clientes"
    assert _names(client) == ["Marketing", "Own use", "Regalos a clientes"]


def test_a_blank_name_is_refused(client: TestClient) -> None:
    response = client.post(PATH, json={"name": "   "})

    assert response.status_code == 422
    assert response.json()["code"] == "stock.withdrawal_reason_name_blank"


def test_a_name_of_sixty_one_characters_is_refused_and_sixty_is_not(client: TestClient) -> None:
    refused = client.post(PATH, json={"name": "x" * 61})

    assert refused.status_code == 422
    assert refused.json()["code"] == "stock.withdrawal_reason_name_too_long"
    _add(client, "x" * 60)


def test_a_duplicate_is_refused_whatever_the_case_or_spacing(client: TestClient) -> None:
    response = client.post(PATH, json={"name": " marketing "})

    assert response.status_code == 409
    assert response.json()["code"] == "stock.withdrawal_reason_name_taken"
    assert _names(client) == ["Marketing", "Own use"]


def test_two_businesses_may_each_have_a_reason_with_the_same_name(
    client: TestClient, other_client: TestClient
) -> None:
    _add(client, "Regalos")
    _add(other_client, "Regalos")

    assert "Regalos" in _names(client)
    assert "Regalos" in _names(other_client)


def test_a_reason_moves_down_and_up(client: TestClient) -> None:
    marketing = _id_of(client, "Marketing")

    down = client.post(f"{PATH}/{marketing}/move", json={"direction": "down"})

    assert down.status_code == 200
    assert [r["name"] for r in down.json()] == ["Own use", "Marketing"]
    up = client.post(f"{PATH}/{marketing}/move", json={"direction": "up"})
    assert [r["name"] for r in up.json()] == ["Marketing", "Own use"]
    assert _names(client) == ["Marketing", "Own use"]


def test_the_first_cannot_move_up_nor_the_last_down(client: TestClient) -> None:
    first = _id_of(client, "Marketing")
    last = _id_of(client, "Own use")

    up = client.post(f"{PATH}/{first}/move", json={"direction": "up"})
    down = client.post(f"{PATH}/{last}/move", json={"direction": "down"})

    for refused in (up, down):
        assert refused.status_code == 409
        assert refused.json()["code"] == "stock.withdrawal_reason_cannot_move"
    assert _names(client) == ["Marketing", "Own use"]


def test_a_move_of_a_missing_reason_is_not_found(client: TestClient) -> None:
    response = client.post(f"{PATH}/9999/move", json={"direction": "up"})

    assert response.status_code == 404
    assert response.json()["code"] == "stock.withdrawal_reason_not_found"


def test_a_reason_of_another_business_is_not_found_and_stays_put(
    client: TestClient, other_client: TestClient
) -> None:
    theirs = _id_of(other_client, "Own use")

    response = client.post(f"{PATH}/{theirs}/move", json={"direction": "up"})

    assert response.status_code == 404
    assert response.json()["code"] == "stock.withdrawal_reason_not_found"
    assert _names(other_client) == ["Marketing", "Own use"]


def test_an_unknown_direction_is_refused(client: TestClient) -> None:
    first = _id_of(client, "Marketing")

    assert client.post(f"{PATH}/{first}/move", json={"direction": "sideways"}).status_code == 422
