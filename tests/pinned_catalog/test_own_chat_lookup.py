"""Buscar mi chat (the plan's subtask 2a-ii): `own_chat_from` and `for_lookup` as pure
functions, and `POST /pinned-catalog/own-chat-lookup` over `FakeTelegram`."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.pinned_catalog.domain.errors import (
    NoMessages,
    SeveralChats,
    TelegramUnreachable,
    TokenInvalid,
    UpdatesRefusal,
    UpdatesRefused,
    UpdatesUnreadable,
)
from app.pinned_catalog.domain.own_chat import own_chat_from
from app.pinned_catalog.domain.refusal_causes import for_lookup
from tests.fakes.telegram import FakeTelegram

TYPED = "123456789:typed-secret-token"
SAVED = "555555555:saved-secret-token"
FOUND = "424242424"
OTHER_FOUND = "737373737"
LOOKUP = "/pinned-catalog/own-chat-lookup"

EXPECTED_CLASS: dict[UpdatesRefusal, type[Exception]] = {
    UpdatesRefusal.TOKEN_INVALID: TokenInvalid,
    UpdatesRefusal.UNREADABLE: UpdatesUnreadable,
}
EXPECTED_CODE: dict[UpdatesRefusal, str] = {
    UpdatesRefusal.TOKEN_INVALID: "pinned_catalog.token_invalid",
    UpdatesRefusal.UNREADABLE: "pinned_catalog.updates_unreadable",
}


def test_own_chat_from_none_raises_no_messages() -> None:
    with pytest.raises(NoMessages):
        own_chat_from(frozenset())


def test_own_chat_from_one_answers_it() -> None:
    assert own_chat_from(frozenset({FOUND})) == FOUND


def test_own_chat_from_several_raises_several_chats() -> None:
    with pytest.raises(SeveralChats):
        own_chat_from(frozenset({FOUND, OTHER_FOUND}))


def test_the_expectation_tables_name_every_member() -> None:
    assert set(EXPECTED_CLASS) == set(UpdatesRefusal)
    assert set(EXPECTED_CODE) == set(UpdatesRefusal)


@pytest.mark.parametrize("cause", list(UpdatesRefusal))
def test_for_lookup_maps_every_cause_to_its_own_error(cause: UpdatesRefusal) -> None:
    assert type(for_lookup(cause)) is EXPECTED_CLASS[cause]


def _lookup(client: TestClient, token: str | None) -> tuple[int, dict[str, object], str]:
    response = client.post(LOOKUP, json={"token": token})
    return response.status_code, response.json(), response.text


def _save_settings(client: TestClient, telegram: FakeTelegram) -> None:
    saved = client.post(
        "/pinned-catalog/test",
        json={"token": SAVED, "own_chat": "111", "channel_chat": None},
    )
    assert saved.status_code == 200, saved.text


def test_one_chat_answers_only_the_own_chat(client: TestClient, telegram: FakeTelegram) -> None:
    telegram.set_private_chats(TYPED, [FOUND])

    status, body, text = _lookup(client, TYPED)

    assert status == 200, text
    assert body == {"own_chat": FOUND}
    assert TYPED not in text


def test_no_chat_answers_no_messages(client: TestClient, telegram: FakeTelegram) -> None:
    status, body, text = _lookup(client, TYPED)

    assert status == 422, text
    assert body["code"] == "pinned_catalog.no_messages"
    assert TYPED not in text


def test_several_chats_answer_several_chats(client: TestClient, telegram: FakeTelegram) -> None:
    telegram.set_private_chats(TYPED, [FOUND, OTHER_FOUND])

    status, body, text = _lookup(client, TYPED)

    assert status == 422, text
    assert body["code"] == "pinned_catalog.several_chats"
    assert FOUND not in text
    assert OTHER_FOUND not in text


@pytest.mark.parametrize("cause", list(UpdatesRefusal))
def test_a_refusal_answers_the_code_of_its_cause(
    client: TestClient, telegram: FakeTelegram, cause: UpdatesRefusal
) -> None:
    telegram.fail_next(UpdatesRefused(cause), "private_chats")

    status, body, text = _lookup(client, TYPED)

    assert status == 422, text
    assert body["code"] == EXPECTED_CODE[cause]
    assert TYPED not in text


def test_unreachable_answers_telegram_unreachable(
    client: TestClient, telegram: FakeTelegram
) -> None:
    telegram.fail_next(TelegramUnreachable(), "private_chats")

    status, body, text = _lookup(client, TYPED)

    assert status == 422, text
    assert body["code"] == "pinned_catalog.telegram_unreachable"
    assert TYPED not in text


def test_no_token_typed_and_none_saved_answers_token_required(
    client: TestClient, telegram: FakeTelegram
) -> None:
    status, body, _ = _lookup(client, None)

    assert status == 422
    assert body["code"] == "pinned_catalog.token_required"
    assert telegram.calls == []


def test_a_typed_token_is_used_over_the_saved_one(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _save_settings(client, telegram)
    telegram.set_private_chats(TYPED, [FOUND])
    telegram.set_private_chats(SAVED, [OTHER_FOUND])

    status, body, _ = _lookup(client, TYPED)

    assert status == 200
    assert body == {"own_chat": FOUND}
    assert ("private_chats", TYPED) in telegram.calls
    assert ("private_chats", SAVED) not in telegram.calls


def test_with_none_typed_the_saved_token_is_used(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _save_settings(client, telegram)
    telegram.set_private_chats(SAVED, [OTHER_FOUND])

    status, body, text = _lookup(client, None)

    assert status == 200, text
    assert body == {"own_chat": OTHER_FOUND}
    assert telegram.calls[-1] == ("private_chats", SAVED)
    assert SAVED not in text


@pytest.mark.parametrize("outcome", ["found", "none", "several", "refused", "unreachable"])
def test_it_writes_nothing_after_any_outcome(
    client: TestClient, telegram: FakeTelegram, outcome: str
) -> None:
    _save_settings(client, telegram)
    before = client.get("/pinned-catalog").json()
    before_status = client.get("/pinned-catalog/status").json()
    if outcome == "found":
        telegram.set_private_chats(TYPED, [FOUND])
    elif outcome == "several":
        telegram.set_private_chats(TYPED, [FOUND, OTHER_FOUND])
    elif outcome == "refused":
        telegram.fail_next(UpdatesRefused(UpdatesRefusal.UNREADABLE), "private_chats")
    elif outcome == "unreachable":
        telegram.fail_next(TelegramUnreachable(), "private_chats")

    client.post(LOOKUP, json={"token": TYPED})

    assert client.get("/pinned-catalog").json() == before
    assert client.get("/pinned-catalog/status").json() == before_status
