"""GH-53: the pinned message reaches English through the existing upkeep, with nothing
new built. A pin published in Spanish gets exactly one edit in place and no new post at
its next trigger; a pin that failed is retried; an English render over the limit takes the
existing `TooLong` path while the triggering save succeeds. Seam: `push(..., "upkeep")`
through the HTTP write routes that trigger it, with `tests/fakes/telegram`.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow
from app.pinned_catalog.domain.status import PinFailure
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
CHANNEL = "@canal"

SPANISH_RENDER = (
    "\U0001f33f **CATÁLOGO** \U0001f33f\n\n"
    "**V1**\n"
    "• Precio x gramo: $9.000\n\n"
    "\U0001f4e9 Consultas y pedidos por privado."
)


def _calls(telegram: FakeTelegram, kind: str) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == kind]


def _publish_qualifying_variety(client: TestClient) -> int:
    variety: dict[str, Any] = client.post("/varieties", json={"name": "V1"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": CHANNEL},
    )
    assert client.post("/pinned-catalog/publish").status_code == 200
    return int(variety["id"])


def _store(engine: Engine, **values: object) -> None:
    with Session(engine) as session:
        session.execute(update(PinnedCatalogRow).values(**values))
        session.commit()


def _trigger(client: TestClient, variety_id: int) -> None:
    response = client.patch(f"/varieties/{variety_id}", json={"name": "V1"})
    assert response.status_code == 200, response.text


def _status(client: TestClient) -> dict[str, Any]:
    status: dict[str, Any] = client.get("/pinned-catalog/status").json()["status"]
    return status


def test_a_pin_published_in_spanish_is_edited_once_in_place_and_never_reposted(
    client: TestClient, engine: Engine, telegram: FakeTelegram
) -> None:
    variety_id = _publish_qualifying_variety(client)
    message_id = telegram.stored_message_id(TOKEN, CHANNEL)
    assert message_id is not None
    _store(engine, last_published_text=SPANISH_RENDER)
    telegram.calls.clear()

    _trigger(client, variety_id)

    assert _calls(telegram, "send") == []
    assert len(_calls(telegram, "edit")) == 1
    assert telegram.stored_message_id(TOKEN, CHANNEL) == message_id
    edited = telegram.text_of(TOKEN, CHANNEL, message_id)
    assert edited is not None
    assert "Price per gram: $9.000" in edited
    assert "Precio x gramo" not in edited

    telegram.calls.clear()
    _trigger(client, variety_id)

    assert telegram.calls == []


def test_a_pin_whose_last_attempt_failed_is_retried_at_the_next_trigger(
    client: TestClient, engine: Engine, telegram: FakeTelegram
) -> None:
    variety_id = _publish_qualifying_variety(client)
    _store(engine, last_failure=PinFailure.TELEGRAM_UNREACHABLE.value)
    assert _status(client)["reason"] == "telegram_unreachable"
    telegram.calls.clear()

    _trigger(client, variety_id)

    assert len(_calls(telegram, "edit")) == 1
    assert _calls(telegram, "send") == []
    assert _status(client)["state"] == "up_to_date"


def test_an_english_render_over_the_limit_is_refused_while_the_save_succeeds(
    client: TestClient, engine: Engine, telegram: FakeTelegram
) -> None:
    variety_id = _publish_qualifying_variety(client)
    _store(engine, last_published_text=SPANISH_RENDER)
    for i in range(1, 18):
        other = client.post("/varieties", json={"name": f"Over{i}"}).json()
        client.post(
            f"/varieties/{other['id']}/prices",
            json={"effective_from": "2026-01-01", "list_price": 9000},
        )
        client.post(
            "/stock/entries",
            json={"variety_id": other["id"], "origin": "opening_stock", "grams": "50"},
        )
        client.put(
            f"/catalog/varieties/{other['id']}",
            json={"shown": True, "emoji": None, "indica_share": None, "aroma": "a" * 200},
        )
    message_id = telegram.stored_message_id(TOKEN, CHANNEL)
    assert message_id is not None
    before = telegram.text_of(TOKEN, CHANNEL, message_id)
    telegram.calls.clear()

    renamed = client.patch(f"/varieties/{variety_id}", json={"name": "V1 Renamed"})

    assert renamed.status_code == 200, renamed.text
    assert _status(client)["reason"] == "too_long"
    assert _calls(telegram, "edit") == []
    assert telegram.text_of(TOKEN, CHANNEL, message_id) == before
