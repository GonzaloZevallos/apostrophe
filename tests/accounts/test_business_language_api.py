"""The stored and the shown language through `TestClient` (docs/adr/0050): the change
route, its refusal, what `/auth/me` and `/business` give, and the pinned catalog's upkeep
after a change. Selectable `en` and `de`, with the fixture `de` copy."""

from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.main import create_app
from app.pinned_catalog.domain.errors import TelegramUnreachable
from app.settings import Settings
from app.shared.language import ENGLISH, TEST_LOCALE, Language
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock, open_business, signed_in
from tests.fakes.telegram import FakeTelegram

LOCALES = Path(__file__).resolve().parent.parent / "fixtures" / "locales"
GERMAN = Language("de")
FRENCH = Language("fr")
TOKEN = "123456789:top-secret-bot-token"


@pytest.fixture
def settings() -> Settings:
    return replace(SETTINGS, selectable_languages=(ENGLISH, GERMAN), locales_dir=LOCALES)


def _change(client: TestClient, tag: str) -> Any:
    return client.put("/business/language", json={"language": tag})


def _stored(client: TestClient) -> str:
    language: str = client.get("/business").json()["language"]
    return language


def test_the_language_goes_en_de_en_and_each_step_reads_back(client: TestClient) -> None:
    assert _stored(client) == "en"

    to_german = _change(client, "de")
    assert to_german.status_code == 200, to_german.text
    assert to_german.json()["language"] == "de"
    assert _stored(client) == "de"

    to_english = _change(client, "en")
    assert to_english.status_code == 200, to_english.text
    assert _stored(client) == "en"


def test_the_business_lists_the_selectable_languages_in_settings_order(
    client: TestClient,
) -> None:
    assert client.get("/business").json()["selectable_languages"] == ["en", "de"]
    assert _change(client, "de").json()["selectable_languages"] == ["en", "de"]


def test_me_shows_the_stored_language(client: TestClient) -> None:
    assert client.get("/auth/me").json()["shown_language"] == "en"

    _change(client, "de")

    assert client.get("/auth/me").json()["shown_language"] == "de"


def test_me_shows_the_forced_language_while_the_business_keeps_its_own(
    engine: Engine, clock: MovableClock, telegram: FakeTelegram, settings: Settings
) -> None:
    forced = create_app(
        replace(settings, forced_language=TEST_LOCALE),
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=telegram,
        upkeep_ticker=False,
    )
    with TestClient(forced) as client:
        signed_in(client, open_business(client, engine, clock, "Forzado", "f@example.com"))
        _change(client, "de")

        assert client.get("/auth/me").json()["shown_language"] == "en-XA"
        assert client.get("/business").json()["language"] == "de"


@pytest.mark.parametrize("tag", ["en-XA", "xx", "not a tag", "", "EN"])
def test_a_value_that_is_not_selectable_is_refused_and_nothing_changes(
    client: TestClient, tag: str
) -> None:
    _change(client, "de")

    refused = _change(client, tag)

    assert refused.status_code == 422
    assert refused.json()["code"] == "business.language_not_selectable"
    detail = refused.json()["detail"]
    assert detail, "the refusal names the rule"
    assert tag not in detail if tag else True
    # The sentence is the fixed rule, the same whatever the value was.
    assert detail == _change(client, "another-value").json()["detail"]
    assert _stored(client) == "de"


def _store(engine: Engine, name: str, language: str) -> None:
    with Session(engine) as session:
        session.query(BusinessRow).filter(BusinessRow.name == name).update({"language": language})
        session.commit()


def test_a_stored_language_off_the_list_is_kept_and_cannot_be_chosen_again(
    client: TestClient, engine: Engine, telegram: FakeTelegram
) -> None:
    _store(engine, "Primer Negocio", "fr")
    telegram.calls.clear()

    assert _stored(client) == "fr"
    assert client.get("/auth/me").json()["shown_language"] == "fr"
    refused = _change(client, "fr")

    assert refused.status_code == 422
    assert refused.json()["code"] == "business.language_not_selectable"
    assert _stored(client) == "fr"
    assert telegram.calls == []


def test_a_rename_keeps_the_language(client: TestClient) -> None:
    _change(client, "de")

    renamed = client.patch("/business", json={"name": "Nuevo Nombre"})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Nuevo Nombre"
    assert _stored(client) == "de"


def test_one_business_changing_its_language_leaves_the_other(
    client: TestClient, other_client: TestClient
) -> None:
    _change(other_client, "de")

    assert _stored(other_client) == "de"
    assert _stored(client) == "en"


def test_a_change_leaves_the_business_s_own_texts(client: TestClient) -> None:
    variety = client.post("/varieties", json={"name": "Ananá"}).json()
    client.put(
        f"/catalog/varieties/{variety['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": "Cítrico"},
    )
    client.put("/catalog/header-footer", json={"header": "Hola!", "footer": "Chau"})
    before = (
        client.get("/catalog/header-footer").json(),
        client.get("/varieties").json(),
        client.get("/catalog/varieties").json(),
    )

    _change(client, "de")

    assert before == (
        client.get("/catalog/header-footer").json(),
        client.get("/varieties").json(),
        client.get("/catalog/varieties").json(),
    )


# --- the pinned catalog's upkeep -------------------------------------------------


def _edits(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == "edit"]


def _posts(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] in ("send", "pin")]


def _status(client: TestClient) -> dict[str, Any]:
    body: dict[str, Any] = client.get("/pinned-catalog/status").json()["status"]
    return body


def _published(client: TestClient) -> int:
    variety = client.post("/varieties", json={"name": "V1"}).json()
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
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    assert client.post("/pinned-catalog/publish").status_code == 200
    return int(variety["id"])


def test_choosing_the_stored_language_sends_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _published(client)
    telegram.calls.clear()

    assert _change(client, "en").status_code == 200

    assert telegram.calls == []


def test_a_change_that_leaves_the_text_identical_edits_and_posts_nothing(
    engine: Engine, clock: MovableClock, telegram: FakeTelegram, settings: Settings
) -> None:
    # The text follows the shown language now, so only a shown language the change does
    # not move leaves it identical: the operator's forced one.
    forced = create_app(
        replace(settings, forced_language=TEST_LOCALE),
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=telegram,
        upkeep_ticker=False,
    )
    with TestClient(forced) as client:
        signed_in(client, open_business(client, engine, clock, "Forzado", "f@example.com"))
        _published(client)
        telegram.calls.clear()

        assert _change(client, "de").status_code == 200

        assert _edits(telegram) == []
        assert _posts(telegram) == []


def _stale(client: TestClient, telegram: FakeTelegram) -> None:
    """Published, then a price change whose edit failed: the business is Out of date."""
    variety_id = _published(client)
    telegram.fail_next(TelegramUnreachable())
    client.patch(f"/varieties/{variety_id}", json={"name": "V1 Renamed"})
    assert _status(client)["state"] == "out_of_date"
    telegram.calls.clear()


def test_a_change_owes_exactly_one_in_place_edit_and_never_posts(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _stale(client, telegram)

    assert _change(client, "de").status_code == 200

    assert len(_edits(telegram)) == 1
    assert _posts(telegram) == []
    assert _status(client)["state"] == "up_to_date"


def test_a_failed_edit_shows_out_of_date_and_the_language_change_stands(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _stale(client, telegram)
    telegram.fail_next(TelegramUnreachable())

    changed = _change(client, "de")

    assert changed.status_code == 200
    assert _status(client)["state"] == "out_of_date"
    assert _stored(client) == "de"
    assert _posts(telegram) == []


def test_a_business_that_never_published_sends_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    assert _change(client, "de").status_code == 200

    assert telegram.calls == []
