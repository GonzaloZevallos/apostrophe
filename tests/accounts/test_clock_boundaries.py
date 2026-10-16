"""A criterion-37 regression check of the accept path (docs/adr/0001: the clock is
injected): an invitation issued at the app's clock and accepted on the same clock opens
a session that `GET /auth/me` answers, with the same statuses and the same body whatever
the day, across a month end and a year end (Argentina days, UTC-3).

It is not the proof for the Onboarding's `created_at`: `tests/onboarding/test_opening.py`
is."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db import make_engine
from app.main import create_app
from tests.conftest import NOW, PASSWORD, SETTINGS, TEST_HASHER, MovableClock, invite
from tests.fakes.telegram import FakeTelegram

NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}

DAYS = [
    pytest.param(NOW, id="NOW"),
    pytest.param(datetime(2026, 10, 31, 18, 0, tzinfo=UTC), id="last day of a month"),
    pytest.param(datetime(2026, 11, 1, 18, 0, tzinfo=UTC), id="first day of the next month"),
    pytest.param(datetime(2026, 11, 1, 2, 30, tzinfo=UTC), id="31/10 at 23:30 in Argentina"),
    pytest.param(datetime(2026, 11, 1, 3, 30, tzinfo=UTC), id="01/11 at 00:30 in Argentina"),
    pytest.param(datetime(2026, 12, 31, 18, 0, tzinfo=UTC), id="31/12"),
    pytest.param(datetime(2027, 1, 1, 18, 0, tzinfo=UTC), id="01/01"),
]


@pytest.mark.parametrize("instant", DAYS)
def test_invite_accept_and_me_answer_the_same_on_every_day(instant: datetime) -> None:
    """Same statuses and same body on every day; the one field that follows the day,
    `today`, is that day's Argentina date."""
    engine = make_engine("sqlite://")
    clock = MovableClock(NOW)
    app = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    clock.set(instant)
    expected_today = (instant - timedelta(hours=3)).date().isoformat()

    try:
        with TestClient(app) as client:
            accepted = client.post(f"/invitations/{invite(engine, clock())}/accept", json=NEW_USER)
            token = accepted.json()["token"]
            me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    finally:
        engine.dispose()

    assert (accepted.status_code, me.status_code) == (201, 200)
    assert me.json() == {
        "email": "nueva@example.com",
        "business_name": "La Huerta",
        "today": expected_today,
    }
