"""`Secure` on the session cookie (docs/adr/0002, ADR-0015): decided only from
`Settings.secure_cookie`, over the same login and logout requests under two
`Settings` — one http, one https with a trusted proxy configured."""

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.accounts.adapters.deps import SESSION_COOKIE
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, PASSWORD, TEST_HASHER, MovableClock, invite

HTTP_SETTINGS = Settings(secret_key="k", database_url="sqlite://", public_url="http://example.com")
HTTPS_SETTINGS = Settings(
    secret_key="k",
    database_url="sqlite://",
    public_url="https://example.com",
    trusted_proxies=("10.0.0.0/8",),
)
NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def _accept_invitation(settings: Settings, engine: Engine, client: TestClient) -> str:
    clock = MovableClock(NOW)
    token = invite(engine, clock())
    response = client.post(f"/invitations/{token}/accept", json=NEW_USER)
    assert response.status_code == 201, response.text
    set_cookie: str = response.headers["set-cookie"]
    return set_cookie


def test_set_cookie_carries_secure_only_under_https() -> None:
    http_engine = make_engine(HTTP_SETTINGS.database_url)
    with TestClient(create_app(HTTP_SETTINGS, engine=http_engine, hasher=TEST_HASHER)) as client:
        http_set_cookie = _accept_invitation(HTTP_SETTINGS, http_engine, client)
    https_engine = make_engine(HTTPS_SETTINGS.database_url)
    with TestClient(create_app(HTTPS_SETTINGS, engine=https_engine, hasher=TEST_HASHER)) as client:
        https_set_cookie = _accept_invitation(HTTPS_SETTINGS, https_engine, client)

    assert SESSION_COOKIE in http_set_cookie
    assert "secure" not in http_set_cookie.lower()
    assert "secure" in https_set_cookie.lower()


def test_logout_clears_the_cookie_with_matching_attributes() -> None:
    http_engine = make_engine(HTTP_SETTINGS.database_url)
    with TestClient(create_app(HTTP_SETTINGS, engine=http_engine, hasher=TEST_HASHER)) as client:
        _accept_invitation(HTTP_SETTINGS, http_engine, client)
        http_logout_cookie = client.post("/auth/logout").headers["set-cookie"]
    https_engine = make_engine(HTTPS_SETTINGS.database_url)
    with TestClient(create_app(HTTPS_SETTINGS, engine=https_engine, hasher=TEST_HASHER)) as client:
        _accept_invitation(HTTPS_SETTINGS, https_engine, client)
        https_logout_cookie = client.post("/auth/logout").headers["set-cookie"]

    assert "secure" not in http_logout_cookie.lower()
    assert "secure" in https_logout_cookie.lower()
