"""Does a write release its request's `Session` before the post-write upkeep runs?

GH-542: the mobile e2e server died with `QueuePool limit of size 5 overflow 10 reached`
during the seed (docs/evidence/GH-542-ci-ok-flake.md). The suspect is the request's one
cached `Session` (`get_session`, shared by `require_session` and the router): FastAPI
closes a yield dependency only after background tasks run, so a write that scheduled
upkeep may still hold a pooled connection while `run_upkeep_safely` opens its own.

Seams (the plan's): `TestClient` over the HTTP API on a file SQLite (never a shared
in-memory connection, which would hide a held connection), observed through
`app.state.engine.pool.checkedout()` from a probe that replaces
`upkeep_trigger.run_upkeep_safely`, and through the real upkeep on the squeezed pool of
`scripts.stress.squeezed_mobile_app`. This test file never takes `locks.for_business`:
`TestClient` runs the background task before it returns, so holding it here would hang.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
from starlette.datastructures import State

from app.clock import Clock
from app.db import make_engine
from app.pinned_catalog.adapters import upkeep_trigger
from app.pinned_catalog.domain.errors import TelegramUnreachable
from app.settings import Settings
from app.shared.language import ENGLISH, Language
from scripts.stress.squeezed_mobile_app import (
    MAX_OVERFLOW,
    POOL_SIZE,
    POOL_TIMEOUT,
    create_squeezed_mobile_app,
    squeezed_engine,
)
from tests.conftest import PASSWORD, SETTINGS, invite
from tests.fakes.telegram import FakeTelegram

LOCALES = Path(__file__).resolve().parent / "fixtures" / "locales"
GERMAN = Language("de")
TOKEN = "123456789:top-secret-bot-token"


@pytest.fixture
def settings() -> Settings:
    return replace(SETTINGS, selectable_languages=(ENGLISH, GERMAN), locales_dir=LOCALES)


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    """A file SQLite, so the engine has a real `QueuePool` whose `checkedout()` counts."""
    engine = make_engine(f"sqlite:///{tmp_path / 'release.db'}")
    yield engine
    engine.dispose()


class Probe:
    """Stands in for `run_upkeep_safely`: records how many connections the request still
    holds at the moment upkeep would start, and does nothing else."""

    def __init__(self) -> None:
        self.checked_out: list[int] = []

    def __call__(self, state: State, business_id: int, today: date) -> None:
        pool = cast(QueuePool, cast(Engine, state.engine).pool)
        self.checked_out.append(pool.checkedout())


@pytest.fixture
def probe(monkeypatch: pytest.MonkeyPatch) -> Probe:
    probe = Probe()
    monkeypatch.setattr(upkeep_trigger, "run_upkeep_safely", probe)
    return probe


def test_a_products_write_holds_no_connection_when_upkeep_starts(
    client: TestClient, probe: Probe
) -> None:
    created = client.post("/api/products", json={"name": "V1"})
    assert created.status_code == 201, created.text
    renamed = client.patch(f"/api/products/{created.json()['id']}", json={"name": "V2"})
    assert renamed.status_code == 200, renamed.text

    assert probe.checked_out == [0, 0]


def test_a_catalog_attributes_write_holds_no_connection_when_upkeep_starts(
    client: TestClient, probe: Probe
) -> None:
    """The route of the request that died in the CI log (`PUT /catalog/...`)."""
    created = client.post("/api/products", json={"name": "V1"}).json()
    probe.checked_out.clear()

    changed = client.put(
        f"/catalog/products/{created['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": "Cítrico"},
    )
    assert changed.status_code == 200, changed.text

    assert probe.checked_out == [0]


def test_a_changed_pricing_switch_holds_no_connection_when_upkeep_starts(
    client: TestClient, probe: Probe
) -> None:
    saved = client.put(
        "/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": False}
    )
    assert saved.status_code == 200, saved.text

    assert probe.checked_out == [0]


def test_a_changed_language_holds_no_connection_when_upkeep_starts(
    client: TestClient, probe: Probe
) -> None:
    changed = client.put("/business/language", json={"language": "de"})
    assert changed.status_code == 200, changed.text

    assert probe.checked_out == [0]


def test_an_unchanged_pricing_switch_schedules_no_upkeep(client: TestClient, probe: Probe) -> None:
    body = {"is_bulk_pricing": False, "is_vip_customers": False}
    assert client.put("/pricing-settings", json=body).status_code == 200

    assert probe.checked_out == []


def test_an_unchanged_language_schedules_no_upkeep(client: TestClient, probe: Probe) -> None:
    assert client.put("/business/language", json={"language": "en"}).status_code == 200

    assert probe.checked_out == []


# The real upkeep on a pool of one connection and no overflow: if the write still held its
# connection, `run_upkeep_safely` would wait a second for one, give up, and the pin would
# stay out of date. Signing in and publishing need two connections at once (the pinned-catalog
# routes open their own session beside the request's), so they run on a roomy pool and the
# engine is squeezed only for the write under test: every reader takes `app.state.engine`
# when it runs, so the swap reaches the write and its upkeep alike.


@pytest.fixture
def squeezed_app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path / 'squeezed.db'}")
    monkeypatch.setenv("STRESS_POOL_SIZE", "5")
    monkeypatch.setenv("STRESS_MAX_OVERFLOW", "0")
    monkeypatch.setenv("STRESS_POOL_TIMEOUT", "5")
    return create_squeezed_mobile_app()


def _sign_in(client: TestClient, url: str, now: datetime) -> None:
    engine = make_engine(url)
    try:
        token = invite(engine, now)
    finally:
        engine.dispose()
    accepted = client.post(
        f"/invitations/{token}/accept",
        json={"business_name": "Squeezed", "email": "squeezed@example.com", "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text
    client.headers["Authorization"] = f"Bearer {accepted.json()['token']}"


def _status(client: TestClient) -> dict[str, Any]:
    status = client.get("/pinned-catalog/status").json()["status"]
    assert isinstance(status, dict)
    return cast(dict[str, Any], status)


def test_the_real_upkeep_syncs_the_pin_on_a_pool_of_one(squeezed_app: FastAPI) -> None:
    roomy = cast(Engine, squeezed_app.state.engine)
    url = roomy.url.render_as_string(hide_password=False)
    with TestClient(squeezed_app) as client:
        _sign_in(client, url, cast(Clock, squeezed_app.state.clock)())
        product = client.post("/api/products", json={"name": "V1"}).json()
        client.post(
            f"/api/products/{product['id']}/prices",
            json={"effective_from": "2026-01-01", "list_price": 9000},
        )
        client.post(
            "/stock/entries",
            json={"product_id": product["id"], "origin": "opening_stock", "quantity": "50"},
        )
        client.post(
            "/pinned-catalog/test",
            json={"token": TOKEN, "own_chat": "111111", "channel_chat": "@canal"},
        )
        assert client.post("/pinned-catalog/publish").status_code == 200
        assert _status(client)["state"] == "up_to_date"
        # The next edit to Telegram fails, so an upkeep that really runs leaves a record the
        # API shows (`telegram_unreachable`, as in the trigger tests); one that cannot get a
        # connection leaves the pin as it was.
        telegram = cast(FakeTelegram, squeezed_app.state.pinned_catalog_telegram.api)
        telegram.fail_next(TelegramUnreachable())

        # Only the write is squeezed: the status read below needs two connections of its
        # own (the request's Session and the snapshot's), which says nothing about upkeep.
        squeezed = squeezed_engine(url, {POOL_SIZE: "1", MAX_OVERFLOW: "0", POOL_TIMEOUT: "1"})
        squeezed_app.state.engine = squeezed
        try:
            # A write that changes the pinned text (a catalog attribute does not), so the
            # upkeep has an edit to attempt.
            changed = client.put("/catalog/header-footer", json={"header": "Hola!", "footer": ""})
        finally:
            squeezed_app.state.engine = roomy
            squeezed.dispose()
        assert changed.status_code == 200, changed.text

        assert _status(client)["reason"] == "telegram_unreachable"


def test_the_squeezed_engine_refuses_a_database_that_has_no_pool_to_squeeze() -> None:
    with pytest.raises(ValueError, match="the squeezed pool needs a file database"):
        squeezed_engine("sqlite://", {})
