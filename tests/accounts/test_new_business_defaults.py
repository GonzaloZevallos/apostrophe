"""A new business opens with its header, footer and four expense categories in its stored
language, and from then on they are its own data (docs/adr/0006, 0050). Selectable `en`
and `de`, over fixture locales whose `de` lines all start with `de: `."""

import shutil
from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.settings import Settings
from app.shared.copy import compile_po
from app.shared.language import ENGLISH, Language
from tests.conftest import (
    PASSWORD,
    SETTINGS,
    MovableClock,
    invite,
    signed_in,
)

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "locales"

ENGLISH_HEADER = "\U0001f33f **CATALOG** \U0001f33f"
ENGLISH_FOOTER = "\U0001f4e9 Questions and orders by private message."
ENGLISH_CATEGORIES = ["Growing supplies", "Other", "Packaging", "Shipping and transport"]
GERMAN_CATEGORIES = [
    "de: Growing supplies",
    "de: Other",
    "de: Packaging",
    "de: Shipping and transport",
]


@pytest.fixture
def locales(tmp_path: Path) -> Path:
    target = tmp_path / "locales"
    shutil.copytree(FIXTURES, target)
    return target


@pytest.fixture
def settings(locales: Path) -> Settings:
    return replace(SETTINGS, selectable_languages=(ENGLISH, Language("de")), locales_dir=locales)


def _accept(client: TestClient, engine: Engine, clock: MovableClock, **kw: str) -> TestClient:
    body = {"email": kw["email"], "password": PASSWORD, "business_name": kw["name"]}
    headers = {"Accept-Language": kw["language"]}
    accepted = client.post(
        f"/invitations/{invite(engine, clock())}/accept", json=body, headers=headers
    )
    assert accepted.status_code == 201, accepted.text
    client.cookies.clear()
    return signed_in(client, accepted.json()["token"])


def _defaults(client: TestClient) -> tuple[str, str, list[str]]:
    catalog = client.get("/catalog").json()
    categories = [c["name"] for c in client.get("/expense-categories").json()]
    return catalog["header"], catalog["footer"], categories


def test_a_business_opened_in_german_stores_the_german_defaults(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    signed = _accept(
        anonymous_client, engine, clock, email="a@example.com", name="Uno", language="de"
    )

    assert _defaults(signed) == (
        f"de: {ENGLISH_HEADER}",
        f"de: {ENGLISH_FOOTER}",
        GERMAN_CATEGORIES,
    )


def test_a_language_change_leaves_the_stored_defaults_as_they_were(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    signed = _accept(
        anonymous_client, engine, clock, email="a@example.com", name="Uno", language="de"
    )

    changed = signed.put("/business/language", json={"language": "en"})

    assert changed.status_code == 200, changed.text
    assert _defaults(signed) == (
        f"de: {ENGLISH_HEADER}",
        f"de: {ENGLISH_FOOTER}",
        GERMAN_CATEGORIES,
    )


def test_an_english_business_in_the_same_app_gets_the_english_defaults_exactly(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    _accept(anonymous_client, engine, clock, email="a@example.com", name="Uno", language="de")

    signed = _accept(
        anonymous_client, engine, clock, email="b@example.com", name="Dos", language="en"
    )

    assert _defaults(signed) == (ENGLISH_HEADER, ENGLISH_FOOTER, ENGLISH_CATEGORIES)


def test_a_business_in_a_language_with_no_compiled_catalog_opens_with_the_english_defaults(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock, locales: Path
) -> None:
    shutil.rmtree(locales / "de")  # the operator lost the copy after the app started

    signed = _accept(
        anonymous_client, engine, clock, email="a@example.com", name="Uno", language="de"
    )

    assert signed.get("/business").json()["language"] == "de"
    assert _defaults(signed) == (ENGLISH_HEADER, ENGLISH_FOOTER, ENGLISH_CATEGORIES)


def _stored_businesses(engine: Engine) -> list[int]:
    with engine.connect() as connection:
        return [row[0] for row in connection.execute(text("select id from business"))]


@pytest.fixture
def unforgiving_client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def _set_german(locales: Path, key: str, value: str) -> None:
    po = locales / "de" / "LC_MESSAGES" / "apostrophe.po"
    blocks = po.read_text(encoding="utf-8").split("\n\n")
    kept = [
        f'msgid "{key}"\nmsgstr "{value}"' if f'msgid "{key}"' in block else block
        for block in blocks
    ]
    po.write_text("\n\n".join(kept), encoding="utf-8")
    compile_po(po, po.with_suffix(".mo"))


def test_an_opening_that_raises_stores_nothing_and_the_same_token_works_once_fixed(
    unforgiving_client: TestClient, engine: Engine, clock: MovableClock, locales: Path
) -> None:
    _set_german(locales, "catalog.default_header", "h" * 501)
    token = invite(engine, clock())
    body = {"email": "a@example.com", "password": PASSWORD, "business_name": "Uno"}
    headers = {"Accept-Language": "de"}

    refused = unforgiving_client.post(f"/invitations/{token}/accept", json=body, headers=headers)

    assert refused.status_code == 500
    assert "h" * 501 not in refused.text
    assert _stored_businesses(engine) == []
    with engine.connect() as connection:
        assert connection.execute(text("select count(*) from app_user")).scalar_one() == 0
        assert connection.execute(text("select count(*) from expense_category")).scalar_one() == 0

    _set_german(locales, "catalog.default_header", "de: kurz")
    accepted = unforgiving_client.post(f"/invitations/{token}/accept", json=body, headers=headers)

    assert accepted.status_code == 201, accepted.text
    signed = signed_in(unforgiving_client, accepted.json()["token"])
    assert signed.get("/catalog").json()["header"] == "de: kurz"
