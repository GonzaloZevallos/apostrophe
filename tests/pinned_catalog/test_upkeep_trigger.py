"""The trigger seam (the subtask's own declared seam): HTTP write routes of varieties,
stock, sales and catalog, through `TestClient`, observed through `FakeTelegram` calls
and `GET /pinned-catalog/status` — PRD metric 1 (the trigger matrix) and metric 4
(resilience), plus the "no sync" cases ADR-0014 promises.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.pinned_catalog.adapters.tables import PinnedCatalogRow
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


def _register_priced_variety(client: TestClient, name: str) -> dict[str, Any]:
    variety: dict[str, Any] = client.post("/varieties", json={"name": name}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    return variety


def _add_stock_entry(client: TestClient, variety_id: int, grams: str = "50") -> dict[str, Any]:
    entry: dict[str, Any] = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": grams},
    ).json()
    return entry


def _register_qualifying_variety(client: TestClient, name: str) -> dict[str, Any]:
    variety = _register_priced_variety(client, name)
    _add_stock_entry(client, variety["id"])
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
    """A refused write's background task must be dropped, not merely a no-op: leaving
    the pin `telegram_unreachable` beforehand means `needs_send` is true regardless of
    whether the text changed, so a task that actually ran would retry and succeed
    (clearing the failure) — it doesn't, which is what tells a dropped task from a
    no-op sync."""
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)
    telegram.fail_next(TelegramUnreachable())
    client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    failed_status = _status(client)
    assert failed_status is not None
    assert failed_status["reason"] == "telegram_unreachable"
    telegram.calls.clear()

    refused = client.post("/varieties", json={"name": ""})
    assert refused.status_code >= 400

    assert telegram.calls == []  # a task that ran would have retried and succeeded
    assert _status(client) == failed_status  # still failed: nothing was retried either


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


def test_header_footer_change_triggers_an_edit(client: TestClient, telegram: FakeTelegram) -> None:
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

    stored_id = telegram.stored_message_id(TOKEN, "@canal")
    assert stored_id is not None
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
    stored_id = telegram.stored_message_id(TOKEN, "@canal")
    assert stored_id is not None
    last_published_text = telegram.text_of(TOKEN, "@canal", stored_id)
    telegram.calls.clear()

    # One more trigger over the limit: still refused, the pin keeps its last text.
    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    assert renamed.status_code == 200, renamed.text

    assert _edits(telegram) == []
    status_after = _status(client)
    assert status_after is not None
    assert status_after["reason"] == "too_long"
    stored_id_after = telegram.stored_message_id(TOKEN, "@canal")
    assert stored_id_after is not None
    assert telegram.text_of(TOKEN, "@canal", stored_id_after) == last_published_text


def test_a_stock_entry_created_brings_a_variety_into_the_catalog(
    client: TestClient, telegram: FakeTelegram
) -> None:
    """A variety priced but never stocked is `no_entries` — out of the text. Its first
    stock entry (`POST /stock/entries`, not a top-up) brings it "in"."""
    variety = _register_priced_variety(client, "V1")
    _publish(client)
    telegram.calls.clear()

    created = client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    assert created.status_code == 201, created.text

    assert len(_edits(telegram)) == 1


def test_editing_a_stock_entry_triggers_an_edit(client: TestClient, telegram: FakeTelegram) -> None:
    """`PUT /stock/entries/{id}` (the brief's own "stock entries ... edited"): moving
    the entry to a different variety sells the first one out and brings the second
    one in, changing the text."""
    sold = client.post("/varieties", json={"name": "WasStocked"}).json()
    client.post(
        f"/varieties/{sold['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    entry = _add_stock_entry(client, sold["id"])
    gains = _register_priced_variety(client, "GainsStock")
    _publish(client)
    telegram.calls.clear()

    edited = client.put(
        f"/stock/entries/{entry['id']}",
        json={"variety_id": gains["id"], "origin": "opening_stock", "grams": "50"},
    )
    assert edited.status_code == 200, edited.text

    assert len(_edits(telegram)) == 1


def test_deleting_a_stock_entry_triggers_an_edit(
    client: TestClient, telegram: FakeTelegram
) -> None:
    """`DELETE /stock/entries/{id}`: the variety's only entry gone sells it out."""
    variety = _register_priced_variety(client, "V1")
    entry = _add_stock_entry(client, variety["id"])
    _publish(client)
    telegram.calls.clear()

    deleted = client.delete(f"/stock/entries/{entry['id']}")
    assert deleted.status_code == 204, deleted.text

    assert len(_edits(telegram)) == 1


def test_nothing_is_attempted_after_a_token_change_until_publicar(
    client: TestClient, telegram: FakeTelegram
) -> None:
    """After a successful test that changes the token, the previous pin is left alone
    and upkeep attempts nothing in the new chat until Publicar (plan, "Changing the
    channel or the token")."""
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)

    changed = client.post(
        "/pinned-catalog/test",
        json={
            "token": "987654321:a-different-bot-token",
            "own_chat": "111",
            "channel_chat": "@canal",
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["previous_pin_left"] is True
    telegram.calls.clear()

    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    assert renamed.status_code == 200, renamed.text

    assert telegram.calls == []
    status = _status(client)
    assert status == {
        "state": "out_of_date",
        "reason": "missing_publish",
        "last_published_on": None,
    }


def test_nothing_is_attempted_after_a_channel_change_until_publicar(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)

    changed = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@otro-canal"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["previous_pin_left"] is True
    telegram.calls.clear()

    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "V1 Renamed"})
    assert renamed.status_code == 200, renamed.text

    assert telegram.calls == []
    status = _status(client)
    assert status == {
        "state": "out_of_date",
        "reason": "missing_publish",
        "last_published_on": None,
    }


def _withdraw(client: TestClient, variety_id: int, grams: str, **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "reason": "promotion",
        "lines": [{"variety_id": variety_id, "grams": grams}],
    }
    response = client.post("/stock/withdrawals", json=body | extra)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def _pinned_text(telegram: FakeTelegram) -> str:
    """The text of the last edit the channel's pin received."""
    return _edits(telegram)[-1][3]


def test_a_withdrawal_that_sells_a_variety_out_triggers_an_edit(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "Alfa")
    _publish(client)
    telegram.calls.clear()

    _withdraw(client, variety["id"], "50")

    assert len(_edits(telegram)) == 1
    assert "Alfa" not in _pinned_text(telegram)


def test_a_withdrawal_that_leaves_the_text_as_it_was_sends_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "Alfa")
    _publish(client)
    telegram.calls.clear()

    _withdraw(client, variety["id"], "5")

    assert _edits(telegram) == []


def test_an_edit_moving_the_only_line_between_varieties_edits_the_pin_once(
    client: TestClient, telegram: FakeTelegram
) -> None:
    alfa = _register_qualifying_variety(client, "Alfa")
    beta = _register_qualifying_variety(client, "Beta")
    withdrawal = _withdraw(client, alfa["id"], "50")
    _publish(client)
    telegram.calls.clear()

    edited = client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json={"reason": "promotion", "lines": [{"variety_id": beta["id"], "grams": "50"}]},
    )
    assert edited.status_code == 200, edited.text

    assert len(_edits(telegram)) == 1
    text = _pinned_text(telegram)
    assert "Beta" not in text
    assert "Alfa" in text


def test_a_delete_that_brings_a_variety_back_above_zero_edits_the_pin(
    client: TestClient, telegram: FakeTelegram
) -> None:
    variety = _register_qualifying_variety(client, "Alfa")
    withdrawal = _withdraw(client, variety["id"], "50")
    _publish(client)
    telegram.calls.clear()

    deleted = client.delete(f"/stock/withdrawals/{withdrawal['id']}")
    assert deleted.status_code == 204, deleted.text

    assert len(_edits(telegram)) == 1
    assert "Alfa" in _pinned_text(telegram)


def test_a_note_only_edit_sends_nothing(client: TestClient, telegram: FakeTelegram) -> None:
    variety = _register_qualifying_variety(client, "Alfa")
    withdrawal = _withdraw(client, variety["id"], "5")
    _publish(client)
    telegram.calls.clear()

    edited = client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json={
            "reason": "promotion",
            "note": "otra nota",
            "lines": [{"variety_id": variety["id"], "grams": "5"}],
        },
    )
    assert edited.status_code == 200, edited.text

    assert _edits(telegram) == []


def test_the_withdrawal_write_routes_are_exactly_the_three_the_tests_above_trigger(
    app: FastAPI,
) -> None:
    """Every `/stock/withdrawals` write sits on `stock_router`, which `app.main` includes
    with `schedule_upkeep`; each of these three is shown above to edit the pin. A fourth
    write route fails here until it has its own trigger test."""
    paths = app.openapi()["paths"]
    writes = {
        (method.upper(), path)
        for path, item in paths.items()
        if path.startswith("/stock/withdrawals")
        for method in item
        if method.upper() != "GET"
    }

    assert writes == {
        ("POST", "/stock/withdrawals"),
        ("PUT", "/stock/withdrawals/{withdrawal_id}"),
        ("DELETE", "/stock/withdrawals/{withdrawal_id}"),
    }


def test_a_pin_posted_with_the_spanish_fixed_lines_gets_one_edit_and_no_new_post(
    client: TestClient, telegram: FakeTelegram, engine: Engine
) -> None:
    """GH-53: only the catalog's fixed lines changed language. A pin posted before it
    differs from today's text in those lines alone, so the next upkeep trigger edits it in
    place (one edit, zero posts) and records the English text."""
    variety = _register_qualifying_variety(client, "V1")
    _publish(client)
    posted = [call for call in telegram.calls if call[0] == "send" and call[2] == "@canal"]
    assert len(posted) == 1
    assert "Price per gram: $9.000" in posted[0][3]
    with Session(engine) as session:
        row = session.scalars(select(PinnedCatalogRow)).one()
        english_stored = row.last_published_text
        assert english_stored is not None
        row.last_published_text = english_stored.replace("Price per gram:", "Precio x gramo:")
        session.commit()
    telegram.calls.clear()

    saved = client.put(
        f"/catalog/varieties/{variety['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": None},
    )

    assert saved.status_code == 200, saved.text
    assert [call[0] for call in telegram.calls] == ["edit"]
    assert telegram.calls[0][3] == posted[0][3]
    with Session(engine) as session:
        assert session.scalars(select(PinnedCatalogRow)).one().last_published_text == english_stored
    status = _status(client)
    assert status is not None
    assert status["state"] == "up_to_date"
