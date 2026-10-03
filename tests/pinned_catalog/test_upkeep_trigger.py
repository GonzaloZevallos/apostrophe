"""The trigger seam (the subtask's own declared seam): HTTP write routes of varieties,
stock, sales and catalog, through `TestClient`, observed through `FakeTelegram` calls
and `GET /pinned-catalog/status` — PRD metric 1 (the trigger matrix) and metric 4
(resilience), plus the "no sync" cases ADR-0014 promises.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.pinned_catalog.domain.errors import TelegramUnreachable
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"


def _edits(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == "edit"]


def _publish(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    response = client.post("/pinned-catalog/publish")
    assert response.status_code == 200, response.text


def _status(client: TestClient) -> dict[str, Any] | None:
    body = client.get("/pinned-catalog/status").json()
    status = body["status"]
    assert status is None or isinstance(status, dict)
    return status


def _register_qualifying_variety(client: TestClient, name: str) -> dict[str, Any]:
    variety: dict[str, Any] = client.post("/varieties", json={"name": name}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    return variety


def test_nothing_is_attempted_before_the_first_publicar(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _register_qualifying_variety(client, "V1")

    assert telegram.calls == []
    assert _status(client) is None


def test_a_refused_write_calls_the_fake_zero_times(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _register_qualifying_variety(client, "V1")
    _publish(client)
    telegram.calls.clear()

    refused = client.post("/varieties", json={"name": ""})
    assert refused.status_code >= 400

    assert telegram.calls == []


def test_a_recorded_price_entry_triggers_an_edit(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = client.post("/varieties", json={"name": "V1"}).json()
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    _publish(client)
    telegram.calls.clear()

    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )

    assert len(_edits(telegram)) == 1
    status = _status(client)
    assert status is not None
    assert status["state"] == "up_to_date"


def test_deleting_the_only_price_entry_triggers_an_edit(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)
    entry_id = client.get(f"/varieties/{variety['id']}/prices").json()[0]["id"]
    telegram.calls.clear()

    deleted = client.delete(f"/varieties/{variety['id']}/prices/{entry_id}")
    assert deleted.status_code == 204

    assert len(_edits(telegram)) == 1


def test_catalog_attributes_change_triggers_an_edit(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)
    telegram.calls.clear()

    changed = client.put(
        f"/catalog/varieties/{variety['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": "Cítrico"},
    )
    assert changed.status_code == 200, changed.text

    assert len(_edits(telegram)) == 1


def test_header_footer_change_triggers_an_edit(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _register_qualifying_variety(client, "V1")
    _publish(client)
    telegram.calls.clear()

    changed = client.put("/catalog/header-footer", json={"header": "Hola!", "footer": ""})
    assert changed.status_code == 200, changed.text

    assert len(_edits(telegram)) == 1


def test_a_variety_renamed_triggers_an_edit(client: TestClient, telegram: FakeTelegram) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)
    telegram.calls.clear()

    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    assert renamed.status_code == 200, renamed.text

    assert len(_edits(telegram)) == 1


def test_a_variety_selling_out_and_coming_back_triggers_edits(
    client: TestClient, telegram: FakeTelegram
) -> None:
    sellable = client.post("/varieties", json={"name": "Sellable"}).json()
    client.post(
        f"/varieties/{sellable['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": sellable["id"], "origin": "opening_stock", "grams": "10"},
    )
    _publish(client)
    telegram.calls.clear()

    sale = client.post(
        "/sales",
        json={"lines": [{"variety_id": sellable["id"], "grams": "10"}], "payment": "cash"},
    )
    assert sale.status_code == 201, sale.text  # sells all the stock: now sold out

    assert len(_edits(telegram)) == 1

    deleted = client.delete(f"/sales/{sale.json()['id']}")  # Deshacer: stock returns
    assert deleted.status_code == 200, deleted.text

    assert len(_edits(telegram)) == 2  # one more edit, back to "in"


def test_topping_up_an_in_catalog_variety_sends_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)
    telegram.calls.clear()

    topped_up = client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "10"},
    )
    assert topped_up.status_code == 201, topped_up.text

    assert _edits(telegram) == []  # already "in"; the text is unchanged


def test_a_message_deleted_then_a_price_change_keeps_showing_message_gone(
    client: TestClient, telegram: FakeTelegram
) -> None:
    """Step-by-step (the subtask's own case): delete the pinned message -> a price
    change records `message_gone` -> deleting that price still shows `message_gone`."""
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)

    messages = telegram._messages[(TOKEN, "@canal")]
    stored_id = next(iter(messages))
    telegram.delete(TOKEN, "@canal", stored_id)
    telegram.calls.clear()

    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-02-01", "list_price": 9500},
    )
    status = _status(client)
    assert status is not None
    assert status["reason"] == "message_gone"

    entry_id = client.get(f"/varieties/{variety['id']}/prices").json()[-1]["id"]
    client.delete(f"/varieties/{variety['id']}/prices/{entry_id}")

    status_after = _status(client)
    assert status_after is not None
    assert status_after["reason"] == "message_gone"


def test_resilience_a_failed_trigger_never_fails_the_save_and_clears_on_the_next_one(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)

    telegram.fail_next(TelegramUnreachable())
    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    assert renamed.status_code == 200, renamed.text  # the save itself always succeeds

    status = _status(client)
    assert status is not None
    assert status["state"] == "out_of_date"
    assert status["reason"] == "telegram_unreachable"
    last_published_on = status["last_published_on"]

    renamed_again = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Again"})
    assert renamed_again.status_code == 200, renamed_again.text

    recovered = _status(client)
    assert recovered == {
        "state": "up_to_date",
        "reason": None,
        "last_published_on": last_published_on,
    }


def test_too_long_text_is_not_sent_and_the_pin_keeps_its_text(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)

    for i in range(1, 18):
        over = client.post("/varieties", json={"name": f"Over{i}"}).json()
        client.post(
            f"/varieties/{over['id']}/prices",
            json={"effective_from": "2026-01-01", "list_price": 9000},
        )
        client.post(
            "/stock/entries",
            json={"variety_id": over["id"], "origin": "opening_stock", "grams": "50"},
        )
        client.put(
            f"/catalog/varieties/{over['id']}",
            json={"shown": True, "emoji": None, "indica_share": None, "aroma": "a" * 200},
        )

    status = _status(client)
    assert status is not None
    assert status["reason"] == "too_long"
    stored_id = next(iter(telegram._messages[(TOKEN, "@canal")]))
    last_published_text = telegram.text_of(TOKEN, "@canal", stored_id)
    telegram.calls.clear()

    # One more trigger over the limit: still refused, the pin keeps its last text.
    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    assert renamed.status_code == 200, renamed.text

    assert _edits(telegram) == []
    status_after = _status(client)
    assert status_after is not None
    assert status_after["reason"] == "too_long"
    assert (
        telegram.text_of(TOKEN, "@canal", next(iter(telegram._messages[(TOKEN, "@canal")])))
        == last_published_text
    )
