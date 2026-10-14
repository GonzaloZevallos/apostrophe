"""`Secure` on the session cookie (docs/adr/0002, ADR-0017): decided only from
`Settings.secure_cookie`, over the same login and logout requests under two
`Settings` — one http, one https with a trusted proxy configured."""

from datetime import UTC, datetime
from http.cookies import SimpleCookie

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.accounts.adapters.deps import SESSION_COOKIE
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import PASSWORD, TEST_HASHER, invite
from tests.fakes.telegram import FakeTelegram

HTTP_SETTINGS = Settings(secret_key="k", database_url="sqlite://", public_url="http://example.com")
HTTPS_SETTINGS = Settings(
    secret_key="k",
    database_url="sqlite://",
    public_url="https://example.com",
    trusted_proxies=("10.0.0.0/8",),
)
NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def _attributes(set_cookie_header: str) -> SimpleCookie:
    jar = SimpleCookie()
    jar.load(set_cookie_header)
    return jar


def _open_business(settings: Settings, engine: Engine, client: TestClient) -> None:
    # The app runs on the real clock, so the invitation is issued on it too.
    token = invite(engine, datetime.now(UTC))
    response = client.post(f"/invitations/{token}/accept", json=NEW_USER)
    assert response.status_code == 201, response.text


def _login_set_cookie(settings: Settings) -> str:
    engine = make_engine(settings.database_url)
    app = create_app(
        settings, engine=engine, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    )
    with TestClient(app) as client:
        _open_business(settings, engine, client)
        # A fresh request, with no cookie carried over from accepting the invitation:
        # the declared seam is `POST /auth/login`'s own `Set-Cookie`, not the one that
        # opening a business happens to also set.
        client.cookies.clear()
        response = client.post(
            "/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]}
        )
    assert response.status_code == 200, response.text
    set_cookie: str = response.headers["set-cookie"]
    return set_cookie


def _logout_set_cookie(settings: Settings) -> str:
    engine = make_engine(settings.database_url)
    app = create_app(
        settings, engine=engine, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    )
    with TestClient(app) as client:
        _open_business(settings, engine, client)
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
