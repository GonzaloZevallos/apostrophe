"""The catalog follows the business's shown language (docs/adr/0050): `GET /catalog`, the
attribute and header/footer PUTs, Test it / Publish, the language change's upkeep and the
Ticker's start-of-day run, over fixture locales (`en`, `en-XA`, a generated `de`), with
real adapters and the fake Telegram port."""

from __future__ import annotations

from dataclasses import replace
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.clock import business_day
from app.main import create_app
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely
from app.pinned_catalog.adapters.ticker import _tick as run_tick
from app.pinned_catalog.application.sync_all import sync_all_published
from app.settings import Settings
from app.shared.language import ENGLISH, TEST_LOCALE, Language
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock, open_business, signed_in
from tests.fakes.telegram import FakeTelegram
from tests.fixture_locales import MARK, build_fixture_locales

GERMAN = Language("de")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return replace(
        SETTINGS,
        selectable_languages=(ENGLISH, GERMAN),
        locales_dir=build_fixture_locales(tmp_path),
    )


def _qualifying_variety(client: TestClient, name: str) -> int:
    variety: int = client.post("/api/products", json={"name": name}).json()["id"]
    priced = client.post(
        f"/api/products/{variety}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    assert priced.status_code == 201, priced.text
    stocked = client.post(
        "/stock/entries",
        json={"variety_id": variety, "origin": "opening_stock", "quantity": "50"},
    )
    assert stocked.status_code == 201, stocked.text
    return variety


def _attributes(client: TestClient, variety: int) -> dict[str, Any]:
    response = client.put(
        f"/catalog/varieties/{variety}",
        json={"shown": True, "emoji": None, "indica_share": 60, "aroma": "Citrus"},
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def _change_language(client: TestClient, tag: str) -> None:
    changed = client.put("/business/language", json={"language": tag})
    assert changed.status_code == 200, changed.text


def _text(client: TestClient) -> str:
    text: str = client.get("/catalog").json()["text"]
    return text


def test_a_german_business_reads_german_lines_while_an_english_one_stays_english(
    client: TestClient, other_client: TestClient
) -> None:
    for each in (client, other_client):
        _attributes(each, _qualifying_variety(each, "Gelato"))
    _change_language(client, "de")

    german = _text(client)
    english = _text(other_client)

    assert f"{MARK}• 60% indica / 40% sativa" in german
    assert f"{MARK}• Aroma/flavor: Citrus" in german
    assert f"{MARK}• Price per gram: $11.000" in german
    assert "• 60% indica / 40% sativa" in english
    assert MARK not in english


def test_the_puts_answer_with_the_text_the_next_get_gives(
    client: TestClient, other_client: TestClient
) -> None:
    for each, tag in ((client, "de"), (other_client, "en")):
        variety = _qualifying_variety(each, "Gelato")
        if tag == "de":
            _change_language(each, "de")
        saved = _attributes(each, variety)
        assert saved["text"] == _text(each)
        header = each.put("/catalog/header-footer", json={"header": "Hi", "footer": "Bye"})
        assert header.json()["text"] == _text(each)
        assert (MARK in header.json()["text"]) is (tag == "de")


def _publish(client: TestClient, token: str) -> None:
    tested = client.post(
        "/pinned-catalog/test",
        json={"token": token, "own_chat": "111", "channel_chat": "@canal"},
    )
    assert tested.status_code == 200, tested.text
    published = client.post("/pinned-catalog/publish")
    assert published.status_code == 200, published.text


def _sent(telegram: FakeTelegram, kind: str, token: str) -> list[str]:
    return [call[3] for call in telegram.calls if call[0] == kind and call[1] == token]


TOKEN_DE = "123456789:token-de"
TOKEN_EN = "123456789:token-en"


def test_test_it_and_publish_send_german_lines_for_a_german_business(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _attributes(client, _qualifying_variety(client, "Gelato"))
    _change_language(client, "de")

    _publish(client, TOKEN_DE)

    sends = _sent(telegram, "send", TOKEN_DE)
    assert len(sends) == 2
    assert all(f"{MARK}• Aroma/flavor: Citrus" in text for text in sends)


def test_a_language_change_edits_the_pin_once_with_no_post_pin_or_new_test(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _attributes(client, _qualifying_variety(client, "Gelato"))
    _publish(client, TOKEN_DE)
    telegram.calls.clear()

    _change_language(client, "de")

    assert [call[0] for call in telegram.calls] == ["edit"]
    assert f"{MARK}• Price per gram: $11.000" in telegram.calls[0][3]
    status = client.get("/pinned-catalog/status").json()["status"]
    assert status["state"] == "up_to_date"
    assert client.post("/pinned-catalog/publish").status_code == 200


def _set_stored_language(engine: Engine, business_id: int, tag: str) -> None:
    with Session(engine) as session:
        session.get_one(BusinessRow, business_id).language = tag
        session.commit()


def _two_pinned_businesses(
    client: TestClient, other_client: TestClient, telegram: FakeTelegram
) -> None:
    for each, token in ((client, TOKEN_DE), (other_client, TOKEN_EN)):
        _attributes(each, _qualifying_variety(each, "Gelato"))
        _publish(each, token)
    telegram.calls.clear()


def _start_of_day(app: FastAPI, clock: MovableClock) -> None:
    clock.set(clock() + timedelta(days=1))
    run_tick(app.state, business_day(clock()))


def test_the_start_of_day_run_gives_each_pin_its_own_language(
    app: FastAPI,
    engine: Engine,
    clock: MovableClock,
    telegram: FakeTelegram,
    client: TestClient,
    other_client: TestClient,
) -> None:
    _two_pinned_businesses(client, other_client, telegram)
    _set_stored_language(engine, 1, "de")

    _start_of_day(app, clock)

    assert f"{MARK}• Aroma/flavor: Citrus" in _sent(telegram, "edit", TOKEN_DE)[0]
    english_edit = _sent(telegram, "edit", TOKEN_EN)
    assert english_edit == [] or MARK not in english_edit[0]


def test_the_forced_language_reaches_both_pins_and_changes_no_stored_language(
    engine: Engine,
    clock: MovableClock,
    telegram: FakeTelegram,
    settings: Settings,
    client: TestClient,
    other_client: TestClient,
) -> None:
    _two_pinned_businesses(client, other_client, telegram)
    _set_stored_language(engine, 1, "de")
    forced = create_app(
        replace(settings, forced_language=TEST_LOCALE),
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=telegram,
        upkeep_ticker=False,
    )

    _start_of_day(forced, clock)

    for token in (TOKEN_DE, TOKEN_EN):
        edits = _sent(telegram, "edit", token)
        assert len(edits) == 1
        assert "Aroma/flavor" not in edits[0]
        assert MARK not in edits[0]
    with Session(engine) as session:
        assert [row.language for row in session.scalars(select(BusinessRow))] == ["de", "en"]


def test_a_language_without_a_compiled_catalog_renders_english_and_stays_stored(
    engine: Engine,
    clock: MovableClock,
    telegram: FakeTelegram,
    settings: Settings,
    tmp_path: Path,
) -> None:
    locales = build_fixture_locales(tmp_path / "no-mo")
    (locales / "de" / "LC_MESSAGES" / "apostrophe.mo").unlink()
    app = create_app(
        replace(settings, locales_dir=locales),
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=telegram,
        upkeep_ticker=False,
    )
    with TestClient(app) as http:
        client = signed_in(http, open_business(http, engine, clock, "Uno", "uno@example.com"))
        _attributes(client, _qualifying_variety(client, "Gelato"))
        _publish(client, TOKEN_DE)
        telegram.calls.clear()

        _change_language(client, "de")

        assert "• Aroma/flavor: Citrus" in _text(client)
        assert MARK not in _text(client)
        assert client.get("/business").json()["language"] == "de"
        status = client.get("/pinned-catalog/status").json()["status"]
        assert status["state"] == "up_to_date"
        assert [call[0] for call in telegram.calls] == []


def test_a_business_removed_between_the_listing_and_its_snapshot_calls_nothing(
    app: FastAPI, telegram: FakeTelegram, clock: MovableClock
) -> None:
    class Removed:
        def due(self, today: date) -> list[int]:
            return [999]

    sync_all_published(
        business_day(clock()),
        Removed(),
        lambda business_id: run_upkeep_safely(app.state, business_id, business_day(clock())),
    )

    assert telegram.calls == []
