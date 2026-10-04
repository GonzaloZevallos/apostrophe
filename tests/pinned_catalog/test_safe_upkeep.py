"""The declared seam `app/pinned_catalog/adapters/safe_upkeep.py::run_upkeep_safely`:
`caplog` for the one fixed log line, and per-business containment proven by running two
businesses through `sync_all_published` in the same call, one of them raising a
non-Telegram error from the fake.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.clock import business_day
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely
from app.pinned_catalog.adapters.sql_due import SqlDueBusinesses
from app.pinned_catalog.application.sync_all import sync_all_published
from tests.conftest import MovableClock
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
CHAT = "@canal"


def _publish(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test", json={"token": TOKEN, "own_chat": "111", "channel_chat": CHAT}
    )
    response = client.post("/pinned-catalog/publish")
    assert response.status_code == 200, response.text


def _publish_then_change_the_text(client: TestClient, clock: MovableClock) -> None:
    """Publishes an empty catalog, then records a price that comes into force
    tomorrow — unseen by today's catalog, so a sync run tomorrow has a changed text to
    send without any background trigger consuming the fake's `fail_next` first."""
    _publish(client)
    variety = client.post("/varieties", json={"name": "V1"}).json()
    tomorrow = business_day(clock()) + timedelta(days=1)
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": tomorrow.isoformat(), "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    clock.set(clock() + timedelta(days=1))


def test_a_non_telegram_failure_logs_exactly_one_fixed_warning_line(
    app: FastAPI,
    client: TestClient,
    clock: MovableClock,
    telegram: FakeTelegram,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _publish_then_change_the_text(client, clock)
    telegram.calls.clear()

    telegram.fail_next(ValueError("a bug, not a Telegram answer"))
    with caplog.at_level(logging.WARNING, logger="apostrophe.pinned_catalog"):
        run_upkeep_safely(app.state, 1, business_day(clock()))

    messages = [record.message for record in caplog.records]
    assert messages == ["pinned catalog sync failed: ValueError"]
    assert "V1" not in messages[0]
    assert CHAT not in messages[0]
    assert TOKEN not in messages[0]
    assert "Telegram" not in messages[0]  # the exception's own message never appears either


def test_a_non_telegram_failure_is_recorded_as_telegram_unreachable(
    app: FastAPI, client: TestClient, clock: MovableClock, telegram: FakeTelegram
) -> None:
    _publish_then_change_the_text(client, clock)
    telegram.calls.clear()

    telegram.fail_next(ValueError("boom"))
    run_upkeep_safely(app.state, 1, business_day(clock()))

    status = client.get("/pinned-catalog/status").json()["status"]
    assert status is not None
    assert status["state"] == "out_of_date"
    assert status["reason"] == "telegram_unreachable"


def test_one_businesss_non_telegram_failure_never_stops_the_others_syncing(
    app: FastAPI,
    client: TestClient,
    other_client: TestClient,
    clock: MovableClock,
    telegram: FakeTelegram,
) -> None:
    """The subtask's own "isolation of failures": the fake raises a non-Telegram error
    for business A (`client`), and business B (`other_client`) still syncs in the same
    `sync_all_published` call.

    Both businesses publish today with a price that only takes effect tomorrow — the
    day-change trigger nobody saves (plan, "Day change") — so only the manual
    `sync_all_published` call below ever touches the fake, never a background trigger
    from the setup writes themselves."""
    tomorrow = business_day(clock()) + timedelta(days=1)

    a_variety = client.post("/varieties", json={"name": "A1"}).json()
    client.post(
        f"/varieties/{a_variety['id']}/prices",
        json={"effective_from": tomorrow.isoformat(), "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": a_variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    _publish(client)

    b_variety = other_client.post("/varieties", json={"name": "B1"}).json()
    other_client.post(
        f"/varieties/{b_variety['id']}/prices",
        json={"effective_from": tomorrow.isoformat(), "list_price": 9000},
    )
    other_client.post(
        "/stock/entries",
        json={"variety_id": b_variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    _publish(other_client)

    telegram.calls.clear()
    clock.set(clock() + timedelta(days=1))
    telegram.fail_next(ValueError("business A's bot misbehaves"))
    due = SqlDueBusinesses(app.state.engine)

    def run(business_id: int) -> None:
        run_upkeep_safely(app.state, business_id, tomorrow)

    sync_all_published(tomorrow, due, run)

    status_a = client.get("/pinned-catalog/status").json()["status"]
    status_b = other_client.get("/pinned-catalog/status").json()["status"]
    assert status_a is not None
    assert status_a["state"] == "out_of_date"
    assert status_a["reason"] == "telegram_unreachable"
    assert status_b is not None
    assert status_b["state"] == "up_to_date"  # B still synced despite A's failure above
