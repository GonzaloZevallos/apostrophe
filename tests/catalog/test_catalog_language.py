"""The catalog follows the business's shown language (docs/adr/0050): `GET /catalog`, the
attribute and header/footer PUTs, Test it / Publish, the language change's upkeep and the
Ticker's start-of-day run, over fixture locales (`en`, `en-XA`, a generated `de`), with
real adapters and the fake Telegram port."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.settings import Settings
from app.shared.language import ENGLISH, Language
from tests.conftest import SETTINGS
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
    variety: int = client.post("/varieties", json={"name": name}).json()["id"]
    priced = client.post(
        f"/varieties/{variety}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    assert priced.status_code == 201, priced.text
    stocked = client.post(
        "/stock/entries",
        json={"variety_id": variety, "origin": "opening_stock", "grams": "50"},
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
