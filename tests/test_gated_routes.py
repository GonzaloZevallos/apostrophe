"""Every route answers 401 without a session, except the ones listed as public
(docs/adr/0002). A capability whose router `app.main` forgets to put behind the gate
fails here, route by route."""

import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import NOW, SETTINGS, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram

PUBLIC = {
    ("GET", "/health"),
    ("POST", "/auth/login"),
    ("POST", "/auth/logout"),
    ("GET", "/invitations/{token}"),
    ("POST", "/invitations/{token}/accept"),
    ("GET", "/reset-links/{token}"),
    ("POST", "/reset-links/{token}"),
}


def _routes(app: FastAPI) -> list[tuple[str, str]]:
    # Read from the OpenAPI document: `app.routes` lists an included router as one
    # opaque entry, so walking it would see none of a capability's routes and pass.
    paths = app.openapi()["paths"]
    return sorted((method.upper(), path) for path, item in paths.items() for method in item)


ROUTES = _routes(
    create_app(
        SETTINGS,
        clock=MovableClock(NOW),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
)
GATED = [route for route in ROUTES if route not in PUBLIC]


def test_the_public_routes_exist_and_every_other_route_is_checked() -> None:
    assert PUBLIC <= set(ROUTES)
    assert len(GATED) > 0


@pytest.mark.parametrize(("method", "path"), GATED, ids=[f"{m} {p}" for m, p in GATED])
def test_route_refuses_a_request_without_a_session(
    anonymous_client: TestClient, method: str, path: str
) -> None:
    concrete = re.sub(r"\{[^}]+\}", "1", path)

    response = anonymous_client.request(method, concrete)

    assert response.status_code == 401
