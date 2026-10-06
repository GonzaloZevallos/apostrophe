"""Probarlo answers its own reason for each cause Telegram's refusal carries, and never
the channel's (the plan's invariants 5, 6 and 7): `for_test_send` over every
`SendRefusal` member, and `POST /pinned-catalog/test` with `FakeTelegram` failing."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.pinned_catalog.domain import errors
from app.pinned_catalog.domain.errors import (
    OwnChatNotFound,
    OwnChatNotStarted,
    SendRefusal,
    TelegramRefused,
    TelegramUnreachable,
    TokenInvalid,
    TooLong,
)
from app.pinned_catalog.domain.refusal_causes import for_test_send
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
OWN_CHAT = "987654321"
CHANNEL = "@mi_canal_privado"

EXPECTED_CLASS: dict[SendRefusal, type[Exception]] = {
    SendRefusal.TOKEN_INVALID: TokenInvalid,
    SendRefusal.CHAT_NOT_STARTED: OwnChatNotStarted,
    SendRefusal.CHAT_NOT_FOUND: OwnChatNotFound,
    SendRefusal.NO_RIGHTS: errors.TestSendFailed,
    SendRefusal.OTHER: errors.TestSendFailed,
}

EXPECTED_CODE: dict[SendRefusal, str] = {
    SendRefusal.TOKEN_INVALID: "pinned_catalog.token_invalid",
    SendRefusal.CHAT_NOT_STARTED: "pinned_catalog.own_chat_not_started",
    SendRefusal.CHAT_NOT_FOUND: "pinned_catalog.own_chat_not_found",
    SendRefusal.NO_RIGHTS: "pinned_catalog.test_failed",
    SendRefusal.OTHER: "pinned_catalog.test_failed",
}


def test_the_expectation_tables_name_every_member() -> None:
    assert set(EXPECTED_CLASS) == set(SendRefusal)
    assert set(EXPECTED_CODE) == set(SendRefusal)


@pytest.mark.parametrize("cause", list(SendRefusal))
def test_for_test_send_maps_every_cause_to_its_own_error(cause: SendRefusal) -> None:
    assert type(for_test_send(cause)) is EXPECTED_CLASS[cause]


def _probarlo(client: TestClient) -> tuple[int, dict[str, object], str]:
    response = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": OWN_CHAT, "channel_chat": CHANNEL},
    )
    return response.status_code, response.json(), response.text


def _assert_nothing_saved(client: TestClient) -> None:
    after = client.get("/pinned-catalog").json()
    assert after["token_saved_on"] is None
    assert after["own_chat"] is None
    assert after["channel_chat"] is None


@pytest.mark.parametrize("cause", list(SendRefusal))
def test_probarlo_answers_the_code_of_each_cause_and_saves_nothing(
    client: TestClient, telegram: FakeTelegram, cause: SendRefusal
) -> None:
    telegram.fail_next(TelegramRefused(cause))

    status, body, text = _probarlo(client)

    assert status == 422, text
    assert body["code"] == EXPECTED_CODE[cause]
    assert body["code"] != "pinned_catalog.bot_cannot_post"
    assert TOKEN not in text
    assert OWN_CHAT not in text
    assert CHANNEL not in text
    _assert_nothing_saved(client)


def test_probarlo_keeps_telegram_unreachable_and_saves_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    telegram.fail_next(TelegramUnreachable())

    status, body, text = _probarlo(client)

    assert status == 422, text
    assert body["code"] == "pinned_catalog.telegram_unreachable"
    assert TOKEN not in text
    _assert_nothing_saved(client)


def test_probarlo_keeps_too_long_when_telegram_says_so(
    client: TestClient, telegram: FakeTelegram
) -> None:
    telegram.fail_next(TooLong())

    status, body, text = _probarlo(client)

    assert status == 422, text
    assert body["code"] == "pinned_catalog.too_long"
    assert TOKEN not in text
    _assert_nothing_saved(client)
