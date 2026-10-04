"""The HTTP seam (the plan's declared seam): `GET /pinned-catalog`,
`GET /pinned-catalog/status`, `POST /pinned-catalog/test` and
`POST /pinned-catalog/publish` through `TestClient` with `FakeTelegram`, proving the
PRD's own metrics — one message per chat, resilience, secrecy — over the real routes
and SQL adapters, never a unit alone.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.domain.bold import fits_in_one_message, telegram_bold
from app.pinned_catalog.domain.errors import TelegramUnreachable
from tests.contract_shapes import assert_matches_fixture
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
OTHER_TOKEN = "987654321:a-different-bot-token"


def _add_variety_with_long_aroma(client: TestClient, index: int) -> None:
    """One qualifying variety with the longest aroma the catalog allows (200
    characters, `catalog.aroma_too_long`'s own limit): enough of these push the text
    over Telegram's 4096 UTF-16-unit limit (confirmed below the module, 18 of them
    land at 4469 units)."""
    variety = client.post("/varieties", json={"name": f"V{index}"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    client.put(
        f"/catalog/varieties/{variety['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": "a" * 200},
    )


def test_before_any_settings_nothing_shows(client: TestClient) -> None:
    pinned = client.get("/pinned-catalog")
    status = client.get("/pinned-catalog/status")

    assert pinned.status_code == 200
    assert pinned.json() == {
        "token_saved_on": None,
        "own_chat": None,
        "channel_chat": None,
        "can_publish": False,
        "status": None,
    }
    assert status.json() == {"status": None}


def test_probarlo_requires_a_token(client: TestClient) -> None:
    response = client.post(
        "/pinned-catalog/test", json={"token": None, "own_chat": "111", "channel_chat": None}
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.token_required"


def test_probarlo_requires_an_own_chat(client: TestClient) -> None:
    response = client.post(
        "/pinned-catalog/test", json={"token": TOKEN, "own_chat": "", "channel_chat": None}
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.own_chat_required"


def test_probarlo_without_a_channel_saves_but_cannot_publish(
    client: TestClient, telegram: FakeTelegram
) -> None:
    response = client.post(
        "/pinned-catalog/test", json={"token": TOKEN, "own_chat": "111", "channel_chat": None}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert_matches_fixture(body, "pinnedCatalogTest")
    assert body["can_publish"] is False
    assert body["previous_pin_left"] is False
    assert body["token_saved_on"] is not None
    assert body["own_chat"] == "111"
    assert len(telegram.calls) == 1
    call = telegram.calls[0]
    assert call[0] == "send"
    assert call[1] == TOKEN
    assert call[2] == "111"
    assert "Por ahora no tenemos nada para ofrecer." in call[3]


def test_publicar_without_a_saved_channel_is_not_ready(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test", json={"token": TOKEN, "own_chat": "111", "channel_chat": None}
    )

    response = client.post("/pinned-catalog/publish")

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.not_ready"


def test_the_token_never_appears_in_any_answer(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    published = client.post("/pinned-catalog/publish")
    pinned = client.get("/pinned-catalog")

    assert TOKEN not in published.text
    assert TOKEN not in pinned.text


def test_the_first_publicar_posts_and_pins_then_a_later_one_only_edits(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    telegram.calls.clear()

    first = client.post("/pinned-catalog/publish")
    assert first.status_code == 200, first.text
    assert_matches_fixture(first.json(), "pinnedCatalog")
    assert first.json()["status"]["state"] == "up_to_date"
    assert len([call for call in telegram.calls if call[0] == "send"]) == 1
    assert len([call for call in telegram.calls if call[0] == "pin"]) == 1

    second = client.post("/pinned-catalog/publish")
    assert second.status_code == 200, second.text

    assert len([call for call in telegram.calls if call[0] == "send"]) == 1  # 0 new posts
    assert len([call for call in telegram.calls if call[0] == "edit"]) == 1
    assert len([call for call in telegram.calls if call[0] == "pin"]) == 2  # every Publicar pins


def test_a_deleted_pinned_message_is_posted_again_by_publicar(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")

    # The message id is never returned by any route (CODING_STANDARDS §9); read it
    # straight from the fake, which stands in for Telegram here — the same way
    # `tests/test_business_isolation.py` reads a payment id straight from the engine.
    messages = telegram._messages[(TOKEN, "@canal")]
    stored_id = next(iter(messages))
    telegram.delete(TOKEN, "@canal", stored_id)
    telegram.calls.clear()

    again = client.post("/pinned-catalog/publish")

    assert again.status_code == 200, again.text
    assert len([call for call in telegram.calls if call[0] == "send"]) == 1
    assert len([call for call in telegram.calls if call[0] == "pin"]) == 1


def test_a_channel_change_leaves_the_previous_pin_and_shows_missing_publish(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")

    changed = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@otro-canal"},
    )

    assert changed.status_code == 200, changed.text
    assert changed.json()["previous_pin_left"] is True

    status = client.get("/pinned-catalog").json()["status"]
    assert status == {
        "state": "out_of_date",
        "reason": "missing_publish",
        "last_published_on": None,
    }


def test_probarlo_refuses_an_over_limit_text_and_sends_and_saves_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    for i in range(18):
        _add_variety_with_long_aroma(client, i)
    catalog_text = client.get("/catalog").json()["text"]
    assert catalog_text is not None
    plain, _ = telegram_bold(catalog_text)
    assert not fits_in_one_message(plain)  # sanity: this catalog really is over the limit

    response = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.too_long"
    assert telegram.calls == []
    after = client.get("/pinned-catalog").json()
    assert after["token_saved_on"] is None


def test_publicar_refuses_an_over_limit_text_after_a_successful_probarlo(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _add_variety_with_long_aroma(client, 0)  # one entry: well under the limit
    probed = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    assert probed.status_code == 200, probed.text
    published = client.post("/pinned-catalog/publish")
    assert published.status_code == 200, published.text
    last_published_on = published.json()["status"]["last_published_on"]
    assert last_published_on is not None

    for i in range(1, 18):  # now over the limit
        _add_variety_with_long_aroma(client, i)
    telegram.calls.clear()

    response = client.post("/pinned-catalog/publish")

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "pinned_catalog.too_long"
    assert telegram.calls == []  # no send, edit or pin

    status = client.get("/pinned-catalog").json()["status"]
    assert status == {
        "state": "out_of_date",
        "reason": "too_long",
        "last_published_on": last_published_on,
    }


def test_a_token_change_leaves_the_previous_pin_and_shows_missing_publish(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")
    telegram.calls.clear()

    changed = client.post(
        "/pinned-catalog/test",
        json={"token": OTHER_TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )

    assert changed.status_code == 200, changed.text
    assert changed.json()["previous_pin_left"] is True

    status = client.get("/pinned-catalog").json()["status"]
    assert status == {
        "state": "out_of_date",
        "reason": "missing_publish",
        "last_published_on": None,
    }

    republished = client.post("/pinned-catalog/publish")
    assert republished.status_code == 200, republished.text
    sends_to_the_channel = [
        call
        for call in telegram.calls
        if call[0] == "send" and call[1] == OTHER_TOKEN and call[2] == "@canal"
    ]
    assert len(sends_to_the_channel) == 1
    pins_to_the_channel = [
        call
        for call in telegram.calls
        if call[0] == "pin" and call[1] == OTHER_TOKEN and call[2] == "@canal"
    ]
    assert len(pins_to_the_channel) == 1


def test_changing_only_the_own_chat_leaves_the_status_unchanged(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")
    before = client.get("/pinned-catalog").json()["status"]

    changed = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "222", "channel_chat": "@canal"},
    )

    assert changed.status_code == 200, changed.text
    assert changed.json()["previous_pin_left"] is False
    after = client.get("/pinned-catalog").json()["status"]
    assert after == before


def test_the_test_copy_and_the_published_copy_both_match_get_catalog_s_text(
    client: TestClient, telegram: FakeTelegram
) -> None:
    """PRD metric 3 (text fidelity): the source text handed to the port equals
    `GET /catalog`'s text, bold left-to-right paired the same way the in-app preview
    is; Probarlo's test send and Publicar's post carry the exact same rendering."""
    variety = client.post("/varieties", json={"name": "Blue Dream"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    catalog_text = client.get("/catalog").json()["text"]
    assert catalog_text is not None
    expected_plain, _ = telegram_bold(catalog_text)

    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")

    sends = [call for call in telegram.calls if call[0] == "send"]
    assert len(sends) == 2  # Probarlo's test send, then Publicar's first post
    assert all(call[3] == expected_plain for call in sends)


def test_a_secret_key_rotation_reads_the_saved_token_as_no_token_saved(
    app: FastAPI, client: TestClient
) -> None:
    """The declared seam "wrong key reads as no token", at the HTTP boundary: a token
    saved under one `APOSTROPHE_SECRET_KEY` and read under another is indistinguishable
    from a business that never saved one."""
    saved = client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["token_saved_on"] is not None

    app.state.pinned_catalog_cipher = TokenCipher("a-rotated-secret-key")

    pinned = client.get("/pinned-catalog")
    assert pinned.status_code == 200
    assert pinned.json()["token_saved_on"] is None
    assert pinned.json()["can_publish"] is False

    retried = client.post(
        "/pinned-catalog/test", json={"token": None, "own_chat": "111", "channel_chat": None}
    )
    assert retried.status_code == 422, retried.text
    assert retried.json()["code"] == "pinned_catalog.token_required"


def test_a_failed_publish_reports_out_of_date_and_a_later_success_clears_it(
    client: TestClient, telegram: FakeTelegram
) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    client.post("/pinned-catalog/publish")

    telegram.fail_next(TelegramUnreachable())
    failed = client.post("/pinned-catalog/publish")

    assert failed.status_code == 422, failed.text
    assert failed.json()["code"] == "pinned_catalog.telegram_unreachable"
    status = client.get("/pinned-catalog").json()["status"]
    assert status is not None
    assert status["state"] == "out_of_date"
    assert status["reason"] == "telegram_unreachable"
    assert status["last_published_on"] is not None  # the earlier success still counts

    recovered = client.post("/pinned-catalog/publish")
    assert recovered.status_code == 200, recovered.text
    status_after = client.get("/pinned-catalog").json()["status"]
    assert status_after == {
        "state": "up_to_date",
        "reason": None,
        "last_published_on": status["last_published_on"],
    }
