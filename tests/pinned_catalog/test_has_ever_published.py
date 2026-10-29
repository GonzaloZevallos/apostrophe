"""`BotFacts.has_ever_published` (docs/adr/0046): true once a Publicar succeeded and never
false again. It reads `pinned_catalog.last_published_at IS NOT NULL`, so this pins the
guarantee over every recorder outcome, through HTTP and the fake Telegram."""

from __future__ import annotations

from collections.abc import Callable

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pinned_catalog.adapters.onboarding_facts import SqlBotFacts
from app.pinned_catalog.domain.errors import BotCannotPost, TelegramUnreachable
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
OTHER_TOKEN = "987654321:a-different-bot-token"
CHANNEL = "@canal"


def _ever_published(app: FastAPI, business_name: str = "Primer Negocio") -> bool:
    with Session(app.state.engine) as session:
        business_id = session.scalars(
            select(BusinessRow.id).where(BusinessRow.name == business_name)
        ).one()
        return SqlBotFacts(session, business_id).has_ever_published()


def _variety(client: TestClient, name: str, aroma: str | None = None) -> int:
    created = client.post("/api/products", json={"name": name})
    assert created.status_code == 201, created.text
    variety_id = int(created.json()["id"])
    priced = client.post(
        f"/api/products/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    assert priced.status_code == 201, priced.text
    stocked = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "quantity": "50"},
    )
    assert stocked.status_code == 201, stocked.text
    if aroma is not None:
        described = client.put(
            f"/catalog/varieties/{variety_id}",
            json={"shown": True, "emoji": None, "indica_share": None, "aroma": aroma},
        )
        assert described.status_code == 200, described.text
    return variety_id


def _probarlo(client: TestClient, token: str | None, channel: str | None) -> None:
    response = client.post(
        "/pinned-catalog/test", json={"token": token, "own_chat": "111", "channel_chat": channel}
    )
    assert response.status_code == 200, response.text


def _published(client: TestClient) -> int:
    variety_id = _variety(client, "V1")
    _probarlo(client, TOKEN, CHANNEL)
    assert client.post("/pinned-catalog/publish").status_code == 200
    return variety_id


def _rename(client: TestClient, variety_id: int, name: str) -> None:
    # A catalog change: upkeep runs after the save and always answers 200.
    renamed = client.patch(f"/api/products/{variety_id}", json={"name": name})
    assert renamed.status_code == 200, renamed.text


def test_before_any_row_and_before_any_publicar_nothing_was_ever_published(
    app: FastAPI, client: TestClient
) -> None:
    assert _ever_published(app) is False

    _variety(client, "V1")
    _probarlo(client, TOKEN, CHANNEL)

    assert _ever_published(app) is False


def test_one_successful_publicar_makes_it_true(app: FastAPI, client: TestClient) -> None:
    _published(client)

    assert _ever_published(app) is True


def test_another_business_never_published(
    app: FastAPI, client: TestClient, other_client: TestClient
) -> None:
    _published(client)

    assert _ever_published(app, "Otro Negocio") is False


def _status(client: TestClient) -> dict[str, object]:
    response = client.get("/pinned-catalog/status")
    assert response.status_code == 200, response.text
    status = response.json()["status"]
    assert isinstance(status, dict)
    return status


def _upkeep_unchanged(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    # A write that leaves the text as it was: upkeep finds nothing to send.
    calls_before = list(telegram.calls)
    saved = client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert saved.status_code == 200, saved.text
    assert telegram.calls == calls_before
    assert _status(client)["state"] == "up_to_date"


def _upkeep_too_long(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    for index in range(1, 18):
        _variety(client, f"Over{index}", aroma="a" * 200)
    status = _status(client)
    assert (status["state"], status["reason"]) == ("out_of_date", "too_long")


def _upkeep_unreachable(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    telegram.fail_next(TelegramUnreachable(), "edit")
    _rename(client, variety_id, "V1 unreachable")
    status = _status(client)
    assert (status["state"], status["reason"]) == ("out_of_date", "telegram_unreachable")


def _upkeep_cannot_post(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    telegram.fail_next(BotCannotPost(), "edit")
    _rename(client, variety_id, "V1 cannot post")
    status = _status(client)
    assert (status["state"], status["reason"]) == ("out_of_date", "bot_cannot_post")


def _upkeep_message_gone(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    message_id = telegram.stored_message_id(TOKEN, CHANNEL)
    assert message_id is not None
    telegram.delete(TOKEN, CHANNEL, message_id)
    _rename(client, variety_id, "V1 gone")
    status = _status(client)
    assert (status["state"], status["reason"]) == ("out_of_date", "message_gone")


def _failed_publicar(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    telegram.fail_next(TelegramUnreachable(), "edit")
    failed = client.post("/pinned-catalog/publish")
    assert failed.status_code >= 400, failed.text


def _token_change(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    _probarlo(client, OTHER_TOKEN, CHANNEL)


def _channel_change(client: TestClient, telegram: FakeTelegram, variety_id: int) -> None:
    _probarlo(client, None, "@otro-canal")


AFTER: list[Callable[[TestClient, FakeTelegram, int], None]] = [
    _upkeep_unchanged,
    _upkeep_too_long,
    _upkeep_unreachable,
    _upkeep_cannot_post,
    _upkeep_message_gone,
    _failed_publicar,
    _token_change,
    _channel_change,
]


@pytest.mark.parametrize("after", AFTER, ids=[step.__name__.strip("_") for step in AFTER])
def test_it_stays_true_after_every_outcome_that_is_not_a_publicar(
    app: FastAPI,
    client: TestClient,
    telegram: FakeTelegram,
    after: Callable[[TestClient, FakeTelegram, int], None],
) -> None:
    variety_id = _published(client)
    assert _ever_published(app) is True

    after(client, telegram, variety_id)

    assert _ever_published(app) is True
