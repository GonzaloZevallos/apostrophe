"""`Secure` on the session cookie (docs/adr/0002, ADR-0017): decided only from
`Settings.secure_cookie`, over the same login and logout requests under two
`Settings` — one http, one https with a trusted proxy configured.

The module fixes every input it depends on: its own client address, an environment with
no `APOSTROPHE_*` variable, and a clock handed to `create_app`. The any-day test moves the
real date under the one place the app reads it (`app.clock.datetime`, the name
`system_clock` looks up on every call)."""

import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, tzinfo
from http.cookies import Morsel, SimpleCookie

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app import clock as app_clock
from app.accounts.adapters.deps import SESSION_COOKIE
from app.accounts.domain.session_token import SESSION_LIFETIME
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, PASSWORD, TEST_HASHER, MovableClock, invite
from tests.fakes.telegram import FakeTelegram

HTTP_SETTINGS = Settings(secret_key="k", database_url="sqlite://", public_url="http://example.com")
HTTPS_SETTINGS = Settings(
    secret_key="k",
    database_url="sqlite://",
    public_url="https://example.com",
    trusted_proxies=("10.0.0.0/8",),
)
NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}
# Inside `HTTPS_SETTINGS.trusted_proxies`, so the trusted-proxy branch really runs there.
CLIENT_ADDRESS = ("10.0.0.1", 12345)
LOGIN = {"email": NEW_USER["email"], "password": NEW_USER["password"]}
# Per settings, headers that argue for the opposite of what `Settings.secure_cookie` says:
# an https claim under http (a mutant inferring `Secure` from the request would switch it
# on), an http claim under https (one that would switch it off).
OPPOSING_HEADERS = {
    "http": {
        "X-Forwarded-For": "203.0.113.9",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Ssl": "on",
        "Forwarded": "proto=https",
    },
    "https": {"X-Forwarded-For": "203.0.113.9", "X-Forwarded-Proto": "http"},
}
SETTINGS_BY_NAME = {"http": HTTP_SETTINGS, "https": HTTPS_SETTINGS}


@pytest.fixture(autouse=True)
def _no_apostrophe_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    # Every `Settings` here is explicit, so nothing reads the environment today; this keeps
    # it that way if a helper ever falls back to `Settings.from_env`.
    for name in [name for name in os.environ if name.startswith("APOSTROPHE_")]:
        monkeypatch.delenv(name, raising=False)


def _attributes(set_cookie_header: str) -> SimpleCookie:
    jar = SimpleCookie()
    jar.load(set_cookie_header)
    return jar


@contextmanager
def _opened_business(settings: Settings) -> Iterator[tuple[TestClient, Engine]]:
    engine = make_engine(settings.database_url)
    clock = MovableClock(NOW)
    app = create_app(
        settings,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    try:
        with TestClient(app, client=CLIENT_ADDRESS) as client:
            token = invite(engine, clock())
            response = client.post(f"/invitations/{token}/accept", json=NEW_USER)
            assert response.status_code == 201, response.text
            yield client, engine
    finally:
        engine.dispose()


def _login_set_cookie(settings: Settings, headers: dict[str, str] | None = None) -> str:
    with _opened_business(settings) as (client, _engine):
        # A fresh request, with no cookie carried over from accepting the invitation:
        # the declared seam is `POST /auth/login`'s own `Set-Cookie`, not the one that
        # opening a business happens to also set.
        client.cookies.clear()
        response = client.post("/auth/login", json=LOGIN, headers=headers)
    assert response.status_code == 200, response.text
    set_cookie: str = response.headers["set-cookie"]
    return set_cookie


def _logout_set_cookie(settings: Settings) -> str:
    with _opened_business(settings) as (client, _engine):
        response = client.post("/auth/logout")
    assert response.status_code == 204, response.text
    set_cookie: str = response.headers["set-cookie"]
    return set_cookie


def test_login_set_cookie_carries_secure_only_under_https() -> None:
    http_cookie = _login_set_cookie(HTTP_SETTINGS)
    https_cookie = _login_set_cookie(HTTPS_SETTINGS)

    http_morsel = _attributes(http_cookie)[SESSION_COOKIE]
    https_morsel = _attributes(https_cookie)[SESSION_COOKIE]
    assert http_morsel["secure"] == ""
    assert https_morsel["secure"] != ""


def test_logout_clears_the_cookie_with_matching_attributes() -> None:
    http_cookie = _logout_set_cookie(HTTP_SETTINGS)
    https_cookie = _logout_set_cookie(HTTPS_SETTINGS)

    http_morsel = _attributes(http_cookie)[SESSION_COOKIE]
    https_morsel = _attributes(https_cookie)[SESSION_COOKIE]
    # `Secure` follows `Settings.secure_cookie`, exactly as `set_cookie` does; every
    # other attribute is the same builder's constant, so it matches regardless.
    assert http_morsel["secure"] == ""
    assert https_morsel["secure"] != ""
    for morsel in (http_morsel, https_morsel):
        assert morsel["httponly"] is True
        assert morsel["samesite"] == "lax"
        assert morsel["path"] == "/"


@pytest.mark.parametrize("name", ["http", "https"])
def test_secure_ignores_the_forwarded_headers_of_the_request(name: str) -> None:
    settings = SETTINGS_BY_NAME[name]

    plain = _attributes(_login_set_cookie(settings))[SESSION_COOKIE]
    forwarded = _attributes(_login_set_cookie(settings, OPPOSING_HEADERS[name]))[SESSION_COOKIE]

    assert forwarded["secure"] == plain["secure"]
    assert (forwarded["secure"] != "") == (name == "https")


class _FrozenDatetime:
    """Stands in for the `datetime` name `app.clock.system_clock` looks up on every call."""

    def __init__(self, instant: datetime) -> None:
        self._instant = instant

    def now(self, tz: tzinfo | None = None) -> datetime:
        return self._instant.astimezone(tz) if tz is not None else self._instant


def _shape(morsel: Morsel[str]) -> dict[str, str]:
    keys = ("secure", "httponly", "samesite", "path", "max-age")
    return {key: morsel[key] for key in keys}


def _day_shapes(
    settings: Settings, real_now: datetime, monkeypatch: pytest.MonkeyPatch
) -> tuple[dict[str, str], dict[str, str]]:
    # The name `datetime` inside `app.clock`, resolved at call time by `system_clock`:
    # `create_app` binds that function as its default argument at import, so patching the
    # function itself would never be seen.
    frozen = _FrozenDatetime(real_now)
    monkeypatch.setattr(app_clock, "datetime", frozen)
    # Control: the name `system_clock` resolves on every call now answers the chosen instant.
    assert vars(app_clock)["datetime"].now(UTC) == real_now
    with _opened_business(settings) as (client, engine):
        with engine.connect() as connection:
            stored = connection.execute(text("SELECT created_at FROM onboarding")).scalar_one()
        # The insert is stamped by the injected clock, not by the moved real date.
        assert datetime.fromisoformat(str(stored)).replace(tzinfo=UTC) == NOW
        client.cookies.clear()
        login = client.post("/auth/login", json=LOGIN)
        assert login.status_code == 200, login.text
        assert login.json()["token"]
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"})
        assert me.status_code == 200, me.text
        logout = client.post("/auth/logout")
        assert logout.status_code == 204, logout.text
    login_morsel = _attributes(login.headers["set-cookie"])[SESSION_COOKIE]
    logout_morsel = _attributes(logout.headers["set-cookie"])[SESSION_COOKIE]
    assert login_morsel["max-age"] == str(int(SESSION_LIFETIME.total_seconds()))
    return _shape(login_morsel), _shape(logout_morsel)


@pytest.mark.parametrize("name", ["http", "https"])
def test_the_cookie_is_the_same_whatever_the_real_date(
    name: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = SETTINGS_BY_NAME[name]
    instants = (
        datetime(2026, 9, 1, 12, 0, tzinfo=UTC),
        datetime(2026, 10, 15, 12, 0, tzinfo=UTC),
        # Past NOW + 30 days + 1 day.
        datetime(2026, 12, 15, 12, 0, tzinfo=UTC),
    )

    shapes = [_day_shapes(settings, instant, monkeypatch) for instant in instants]

    assert shapes[0] == shapes[1] == shapes[2]
    assert (shapes[0][0]["secure"] != "") == (name == "https")
