"""The declared seam `app/pinned_catalog/adapters/ticker.py`, started via
`create_app(upkeep_ticker=True)` over a file-backed engine (start/stop only): it runs
once at startup, and the task `app.main.lifespan` hangs on `app.state` is done once the
app has shut down.
"""

from __future__ import annotations

import time
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.pinned_catalog.adapters.ticker as ticker_module
from app.db import make_engine
from app.main import create_app
from app.pinned_catalog.application.ports import DueBusinesses
from app.settings import Settings
from tests.conftest import NOW, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram


def test_ticker_runs_once_at_startup_and_stops_on_shutdown(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[date] = []

    def fake_sync_all_published(today: date, due: DueBusinesses, run: object) -> None:
        calls.append(today)

    monkeypatch.setattr(ticker_module, "sync_all_published", fake_sync_all_published)

    engine = make_engine(f"sqlite:///{tmp_path / 'ticker.db'}")
    settings = Settings(secret_key="ticker-secret-key", database_url="sqlite://")
    app = create_app(
        settings,
        engine=engine,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=True,
        clock=MovableClock(NOW),
    )

    with TestClient(app) as test_client:
        # A business needs to exist before the ticker is meaningful to anything but its
        # own start/stop; this proves the app still answers while the ticker runs.
        invited = test_client.post("/invitations/does-not-exist/accept", json={})
        assert invited.status_code in (404, 422)

        deadline = time.monotonic() + 2.0
        while not calls and time.monotonic() < deadline:
            time.sleep(0.02)
        assert calls, "the ticker should have run once at startup"

        task = app.state.pinned_catalog_ticker_task
        assert task is not None
        assert not task.done()

    assert task.done()  # the lifespan cancelled it, and awaited the cancellation
