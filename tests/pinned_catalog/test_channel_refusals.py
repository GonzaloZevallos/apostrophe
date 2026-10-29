"""Publicar and upkeep keep the channel's reason whatever cause Telegram's refusal
carries (the plan's invariants 2, 5 and 7): every `SendRefusal` member, at each call of
Publicar and upkeep, through `POST /pinned-catalog/publish`, the upkeep triggers and
`GET /pinned-catalog/status`, with `FakeTelegram` failing. And the units under it:
`for_channel` and `ChannelTelegram` over a fake `TelegramApi`."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.pinned_catalog.application.channel_telegram import ChannelTelegram
from app.pinned_catalog.domain.errors import BotCannotPost, SendRefusal, TelegramRefused
from app.pinned_catalog.domain.refusal_causes import for_channel
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
CAUSES = list(SendRefusal)


def test_the_cause_list_names_every_member() -> None:
    # The matrices below iterate `SendRefusal` itself, so a new member joins them.
    assert set(CAUSES) == {
        SendRefusal.TOKEN_INVALID,
        SendRefusal.CHAT_NOT_STARTED,
        SendRefusal.CHAT_NOT_FOUND,
        SendRefusal.NO_RIGHTS,
        SendRefusal.OTHER,
    }


@pytest.mark.parametrize("cause", CAUSES)
def test_for_channel_folds_every_cause_to_bot_cannot_post(cause: SendRefusal) -> None:
    assert isinstance(for_channel(cause), BotCannotPost)


@pytest.mark.parametrize("cause", CAUSES)
@pytest.mark.parametrize("method", ["send", "edit", "pin"])
def test_channel_telegram_turns_each_cause_into_bot_cannot_post(
    cause: SendRefusal, method: str
) -> None:
    fake = FakeTelegram()
    channel = ChannelTelegram(fake)
    message_id = channel.send(TOKEN, "@canal", "hola", [])
    fake.fail_next(TelegramRefused(cause), method)
    calls: dict[str, Callable[[], object]] = {
        "send": lambda: channel.send(TOKEN, "@canal", "hola", []),
        "edit": lambda: channel.edit(TOKEN, "@canal", message_id, "chau", []),
        "pin": lambda: channel.pin(TOKEN, "@canal", message_id),
    }

    with pytest.raises(BotCannotPost) as excinfo:
        calls[method]()

    assert excinfo.value.__cause__ is None
    assert excinfo.value.__suppress_context__ is True


def test_channel_telegram_passes_a_success_through() -> None:
    channel = ChannelTelegram(FakeTelegram())

    message_id = channel.send(TOKEN, "@canal", "hola", [])

    assert channel.edit(TOKEN, "@canal", message_id, "hola", []) == "unchanged"
    assert channel.edit(TOKEN, "@canal", message_id, "chau", []) == "edited"
    channel.pin(TOKEN, "@canal", message_id)


def _tested(client: TestClient) -> None:
    response = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    assert response.status_code == 200, response.text


def _status(client: TestClient) -> dict[str, Any] | None:
    status = client.get("/pinned-catalog/status").json()["status"]
    assert status is None or isinstance(status, dict)
    return status


def _qualifying_variety(client: TestClient) -> dict[str, Any]:
    variety: dict[str, Any] = client.post("/api/products", json={"name": "V1"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "quantity": "50"},
    )
    return variety


@pytest.mark.parametrize("cause", CAUSES)
def test_a_first_publicar_whose_send_is_refused_answers_the_channel_reason(
    client: TestClient, telegram: FakeTelegram, cause: SendRefusal
) -> None:
    _tested(client)
    telegram.fail_next(TelegramRefused(cause), "send")

    response = client.post("/pinned-catalog/publish")

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.bot_cannot_post"
    assert _status(client) is None  # nothing was ever published: no status shows, as before


@pytest.mark.parametrize("cause", CAUSES)
def test_publicar_whose_pin_is_refused_answers_the_channel_reason(
    client: TestClient, telegram: FakeTelegram, cause: SendRefusal
) -> None:
    _tested(client)
    telegram.fail_next(TelegramRefused(cause), "pin")

    response = client.post("/pinned-catalog/publish")

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.bot_cannot_post"
    status = _status(client)
    assert status is not None
    assert status["reason"] == "bot_cannot_post"


@pytest.mark.parametrize("cause", CAUSES)
def test_publicar_over_an_existing_message_answers_the_channel_reason(
    client: TestClient, telegram: FakeTelegram, cause: SendRefusal
) -> None:
    _tested(client)
    assert client.post("/pinned-catalog/publish").status_code == 200
    telegram.fail_next(TelegramRefused(cause), "edit")

    response = client.post("/pinned-catalog/publish")

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.bot_cannot_post"
    status = _status(client)
    assert status is not None
    assert status["reason"] == "bot_cannot_post"


@pytest.mark.parametrize("cause", CAUSES)
def test_upkeep_records_the_channel_reason_for_every_cause(
    client: TestClient, telegram: FakeTelegram, cause: SendRefusal
) -> None:
    variety = _qualifying_variety(client)
    _tested(client)
    assert client.post("/pinned-catalog/publish").status_code == 200
    telegram.fail_next(TelegramRefused(cause), "edit")

    renamed = client.patch(f"/api/products/{variety['id']}", json={"name": "V1 Renamed"})

    assert renamed.status_code == 200, renamed.text  # upkeep never fails the save
    status = _status(client)
    assert status is not None
    assert status["state"] == "out_of_date"
    assert status["reason"] == "bot_cannot_post"
