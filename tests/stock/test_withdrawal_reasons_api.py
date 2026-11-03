"""The withdrawal reasons through the HTTP API, over a real database."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.stock.adapters.sql_withdrawal_reasons import SqlWithdrawalReasons
from app.stock.adapters.tables import WithdrawalReasonRow
from app.stock.domain.errors import ReasonHasWithdrawals
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


def _withdraw_under(client: TestClient, reason_id: int) -> int:
    variety_id = client.post("/api/products", json={"name": "Zkittlez"}).json()["id"]
    response = client.post(
        "/stock/withdrawals",
        json={"reason_id": reason_id, "lines": [{"product_id": variety_id, "quantity": "1"}]},
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def test_a_reason_is_renamed_trimmed_and_keeps_its_place(client: TestClient) -> None:
    marketing = _id_of(client, "Marketing")

    response = client.patch(f"{PATH}/{marketing}", json={"name": "  Publicidad   paga "})

    assert response.status_code == 200, response.text
    assert response.json() == {"id": marketing, "name": "Publicidad paga"}
    assert _names(client) == ["Publicidad paga", "Own use"]


def test_a_reason_may_be_renamed_to_its_own_name_in_another_case(client: TestClient) -> None:
    marketing = _id_of(client, "Marketing")

    response = client.patch(f"{PATH}/{marketing}", json={"name": "MARKETING"})

    assert response.status_code == 200, response.text
    assert _names(client) == ["MARKETING", "Own use"]


@pytest.mark.parametrize("name", ["Own use", "own use", "  OWN   USE "])
def test_a_rename_onto_a_taken_name_is_refused_and_changes_nothing(
    client: TestClient, name: str
) -> None:
    marketing = _id_of(client, "Marketing")

    response = client.patch(f"{PATH}/{marketing}", json={"name": name})

    assert response.status_code == 409
    assert response.json()["code"] == "stock.withdrawal_reason_name_taken"
    assert _names(client) == ["Marketing", "Own use"]


def test_a_rename_to_a_blank_or_an_overlong_name_is_refused_and_changes_nothing(
    client: TestClient,
) -> None:
    marketing = _id_of(client, "Marketing")

    blank = client.patch(f"{PATH}/{marketing}", json={"name": "   "})
    too_long = client.patch(f"{PATH}/{marketing}", json={"name": "x" * 61})
    longest = client.patch(f"{PATH}/{marketing}", json={"name": "x" * 60})

    assert (blank.status_code, blank.json()["code"]) == (422, "stock.withdrawal_reason_name_blank")
    assert (too_long.status_code, too_long.json()["code"]) == (
        422,
        "stock.withdrawal_reason_name_too_long",
    )
    assert longest.status_code == 200
    assert _names(client) == ["x" * 60, "Own use"]


def test_a_rename_of_a_missing_or_foreign_reason_is_not_found(
    client: TestClient, other_client: TestClient
) -> None:
    theirs = _id_of(other_client, "Own use")

    for reason_id in (9999, theirs):
        response = client.patch(f"{PATH}/{reason_id}", json={"name": "Nueva"})
        assert response.status_code == 404
        assert response.json()["code"] == "stock.withdrawal_reason_not_found"
    assert _names(other_client) == ["Marketing", "Own use"]


def test_a_reason_without_withdrawals_is_deleted_and_gone_from_the_list(
    client: TestClient,
) -> None:
    extra = _add(client, "Regalos")["id"]

    response = client.delete(f"{PATH}/{extra}")

    assert response.status_code == 204
    assert response.content == b""
    assert _names(client) == ["Marketing", "Own use"]
    assert client.delete(f"{PATH}/{extra}").status_code == 404


def test_a_reason_with_withdrawals_is_refused_and_stays(client: TestClient) -> None:
    marketing = _id_of(client, "Marketing")
    _withdraw_under(client, marketing)

    response = client.delete(f"{PATH}/{marketing}")

    assert response.status_code == 409
    assert response.json()["code"] == "stock.withdrawal_reason_has_withdrawals"
    assert _names(client) == ["Marketing", "Own use"]


def test_a_reason_stays_refused_after_its_withdrawal_moves_away_then_frees_it(
    client: TestClient,
) -> None:
    marketing = _id_of(client, "Marketing")
    own_use = _id_of(client, "Own use")
    withdrawal_id = _withdraw_under(client, marketing)
    variety_id = client.get(f"/stock/withdrawals/{withdrawal_id}").json()["lines"][0]["product_id"]

    edited = client.put(
        f"/stock/withdrawals/{withdrawal_id}",
        json={"reason_id": own_use, "lines": [{"product_id": variety_id, "quantity": "1"}]},
    )

    assert edited.status_code == 200, edited.text
    assert client.delete(f"{PATH}/{marketing}").status_code == 204
    assert client.delete(f"{PATH}/{own_use}").status_code == 409


def test_the_last_reason_is_refused_and_stays(client: TestClient) -> None:
    client.delete(f"{PATH}/{_id_of(client, 'Marketing')}")
    last = _id_of(client, "Own use")

    response = client.delete(f"{PATH}/{last}")

    assert response.status_code == 409
    assert response.json()["code"] == "stock.withdrawal_reason_last"
    assert _names(client) == ["Own use"]


def test_a_delete_of_a_missing_or_foreign_reason_is_not_found_and_leaves_it(
    client: TestClient, other_client: TestClient
) -> None:
    theirs = _id_of(other_client, "Own use")

    for reason_id in (9999, theirs):
        response = client.delete(f"{PATH}/{reason_id}")
        assert response.status_code == 404
        assert response.json()["code"] == "stock.withdrawal_reason_not_found"
    assert _names(other_client) == ["Marketing", "Own use"]


def test_the_guarded_delete_refuses_the_last_reason_even_without_the_use_case_check(
    client: TestClient, engine: Engine
) -> None:
    client.delete(f"{PATH}/{_id_of(client, 'Marketing')}")
    last = _id_of(client, "Own use")

    with Session(engine) as session:
        business_id = session.query(WithdrawalReasonRow.business_id).filter_by(id=last).scalar()
        assert business_id is not None
        removed = SqlWithdrawalReasons(session, business_id).remove(last)
        session.commit()

    assert removed is False
    assert _names(client) == ["Own use"]


def test_the_guarded_delete_removes_a_reason_when_a_sibling_remains(
    client: TestClient, engine: Engine
) -> None:
    extra = _add(client, "Regalos")["id"]

    with Session(engine) as session:
        business_id = session.query(WithdrawalReasonRow.business_id).filter_by(id=extra).scalar()
        assert business_id is not None
        removed = SqlWithdrawalReasons(session, business_id).remove(extra)
        session.commit()

    assert removed is True
    assert _names(client) == ["Marketing", "Own use"]


def test_the_foreign_key_refuses_the_guarded_delete_of_a_reason_with_withdrawals(
    client: TestClient, engine: Engine
) -> None:
    marketing = _id_of(client, "Marketing")
    _withdraw_under(client, marketing)

    with Session(engine) as session:
        business_id = (
            session.query(WithdrawalReasonRow.business_id).filter_by(id=marketing).scalar()
        )
        assert business_id is not None
        with pytest.raises(ReasonHasWithdrawals):
            SqlWithdrawalReasons(session, business_id).remove(marketing)

    assert _names(client) == ["Marketing", "Own use"]
