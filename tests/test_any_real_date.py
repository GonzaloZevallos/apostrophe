"""The verdicts of the accounts flow do not depend on the real date (docs/adr/0001).

The suite fixes `NOW` in `tests/conftest.py`; an invitation lives 7 days and a session 30,
so a path that reached the real date would turn red once the calendar left that window.
Each test below answers a verdict twice, through the HTTP API on an app built with
`MovableClock(NOW)`: once with the real date at its own value, once with `app.clock`
reading 400 days past `NOW`, and requires the two to be equal.
"""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta, tzinfo

import pytest
from fastapi.testclient import TestClient

from app import clock as app_clock
from app.db import make_engine
from app.main import create_app
from tests.conftest import NOW, PASSWORD, SETTINGS, TEST_HASHER, MovableClock, invite
from tests.fakes.telegram import FakeTelegram

REAL_DATE = NOW + timedelta(days=400)
BRAKE_RELEASE = timedelta(minutes=15)
EMAIL = "fecha@example.com"
WRONG = {"email": EMAIL, "password": "wrong password"}
RIGHT = {"email": EMAIL, "password": PASSWORD}


class _FrozenDatetime:
    """Stands in for the `datetime` name `app.clock.system_clock` looks up on every call."""

    def __init__(self, instant: datetime) -> None:
        self._instant = instant

    def now(self, tz: tzinfo | None = None) -> datetime:
        return self._instant.astimezone(tz) if tz is not None else self._instant


@contextmanager
def _world() -> Iterator[tuple[TestClient, MovableClock, Callable[[], str]]]:
    """A fresh app on `MovableClock(NOW)`, and a way to issue it an invitation."""
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
    try:
        with TestClient(app) as web:
            yield web, clock, lambda: invite(engine, clock())
    finally:
        engine.dispose()


def _verdict_at_both_dates[V](
    verdict: Callable[[TestClient, MovableClock, Callable[[], str]], V],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[V, V]:
    with _world() as (web, clock, issue):
        at_now = verdict(web, clock, issue)
    # The name `datetime` inside `app.clock`, resolved at call time by `system_clock`:
    # `create_app` binds that function as its default at import, so patching the
    # function itself would never be seen.
    monkeypatch.setattr(app_clock, "datetime", _FrozenDatetime(REAL_DATE))
    # Control: the name `system_clock` resolves on every call now answers the moved date.
    assert vars(app_clock)["datetime"].now(UTC) == REAL_DATE
    with _world() as (web, clock, issue):
        moved = verdict(web, clock, issue)
    return at_now, moved


def _accept(web: TestClient, issue: Callable[[], str]) -> str:
    accepted = web.post(
        f"/invitations/{issue()}/accept",
        json={"business_name": "La Fecha", "email": EMAIL, "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text
    token: str = accepted.json()["token"]
    return token


def _invitation_is_accepted(web: TestClient, clock: MovableClock, issue: Callable[[], str]) -> int:
    return web.post(
        f"/invitations/{issue()}/accept",
        json={"business_name": "La Fecha", "email": EMAIL, "password": PASSWORD},
    ).status_code


def _session_reaches_gated_routes(
    web: TestClient, clock: MovableClock, issue: Callable[[], str]
) -> tuple[int, int, int, str]:
    refused = web.get("/customers").status_code
    token = _accept(web, issue)
    web.cookies.clear()
    web.headers["Authorization"] = f"Bearer {token}"
    me = web.get("/auth/me")
    return refused, me.status_code, web.get("/customers").status_code, me.json()["today"]


def _brake_locks_then_releases(
    web: TestClient, clock: MovableClock, issue: Callable[[], str]
) -> tuple[list[int], int, int]:
    _accept(web, issue)
    web.cookies.clear()
    failures = [web.post("/auth/login", json=WRONG).status_code for _ in range(5)]
    locked = web.post("/auth/login", json=RIGHT).status_code
    clock.set(NOW + BRAKE_RELEASE)
    return failures, locked, web.post("/auth/login", json=RIGHT).status_code


def test_an_invitation_issued_at_the_clock_is_accepted_whatever_the_real_date(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    at_now, moved = _verdict_at_both_dates(_invitation_is_accepted, monkeypatch)

    assert at_now == 201
    assert moved == at_now


def test_its_session_reaches_a_gated_route_whatever_the_real_date(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    at_now, moved = _verdict_at_both_dates(_session_reaches_gated_routes, monkeypatch)

    assert at_now == (401, 200, 200, "2026-10-02")
    assert moved == at_now


def test_the_login_brake_locks_then_releases_whatever_the_real_date(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    at_now, moved = _verdict_at_both_dates(_brake_locks_then_releases, monkeypatch)

    assert at_now == ([401] * 5, 429, 200)
    assert moved == at_now
