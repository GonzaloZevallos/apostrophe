"""The declared seam `app/pinned_catalog/application/sync_all.py::sync_all_published`:
pure application code, over fakes only — no `TestClient`, no database.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.clock import business_day
from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely
from app.pinned_catalog.adapters.sql_due import SqlDueBusinesses
from app.pinned_catalog.application.ports import DueBusinesses
from app.pinned_catalog.application.sync_all import sync_all_published
from tests.conftest import MovableClock
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"


class _FakeDueBusinesses:
    def __init__(self, due_ids: list[int]) -> None:
        self._due_ids = due_ids
        self.asked: list[date] = []

    def due(self, today: date) -> list[int]:
        self.asked.append(today)
        return self._due_ids


def test_sync_all_published_runs_every_due_business() -> None:
    due: DueBusinesses = _FakeDueBusinesses([1, 2, 3])
    ran: list[int] = []

    sync_all_published(date(2026, 10, 3), due, ran.append)

    assert ran == [1, 2, 3]


def test_sync_all_published_asks_due_businesses_for_the_given_today() -> None:
    fake = _FakeDueBusinesses([])

    sync_all_published(date(2026, 10, 3), fake, lambda business_id: None)

    assert fake.asked == [date(2026, 10, 3)]


def test_no_due_businesses_runs_nothing() -> None:
    ran: list[int] = []

    sync_all_published(date(2026, 10, 3), _FakeDueBusinesses([]), ran.append)

    assert ran == []


def test_the_day_change_syncs_a_price_that_takes_effect_tomorrow(
    app: FastAPI, client: TestClient, clock: MovableClock, telegram: FakeTelegram
) -> None:
    """The one trigger nobody saves (plan, "Day change"): a price entry effective
    tomorrow is invisible to today's catalog, so the first Publicar goes out empty.
    Moving the `MovableClock` to tomorrow and calling `sync_all_published` the way the
    ticker does picks it up without anyone touching the business."""
    variety = client.post("/varieties", json={"name": "Tomorrow's Price"}).json()
    tomorrow = business_day(clock()) + timedelta(days=1)
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": tomorrow.isoformat(), "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "grams": "50"},
    )
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    published = client.post("/pinned-catalog/publish")
    assert published.status_code == 200, published.text
    assert published.json()["status"]["state"] == "up_to_date"
    telegram.calls.clear()

    clock.set(clock() + timedelta(days=1))
    due = SqlDueBusinesses(app.state.engine)

    def run(business_id: int) -> None:
        run_upkeep_safely(app.state, business_id, tomorrow)

    sync_all_published(tomorrow, due, run)

    edits = [call for call in telegram.calls if call[0] == "edit"]
    assert len(edits) == 1
    assert "Tomorrow's Price" in edits[0][3]

    status = client.get("/pinned-catalog/status").json()["status"]
    assert status == {
        "state": "up_to_date",
        "reason": None,
        "last_published_on": tomorrow.isoformat(),
    }


