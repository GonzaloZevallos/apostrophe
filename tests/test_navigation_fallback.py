"""A browser navigation to a front route gets `index.html`; everything else gets the API
(docs/adr/0024). `create_app` over a temporary `web_dist`, driven through `TestClient`.
"""

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.main import create_app
from app.settings import Settings
from tests.conftest import SETTINGS, TEST_HASHER
from tests.fakes.telegram import FakeTelegram
from tests.test_refusal_codes import CONTRACT_PATH

SHELL = "<html>the app shell</html>"
VARY = "Sec-Fetch-Mode, Accept"
CONTRACT = json.loads(CONTRACT_PATH.read_text())
ROUTE_SEGMENTS: list[str] = CONTRACT["routeSegments"]

NAVIGATE = {"Sec-Fetch-Mode": "navigate"}
HTML_ACCEPT = {"Accept": "text/html,application/xhtml+xml,*/*;q=0.8"}
JSON_ACCEPT = {"Accept": "application/json"}


@pytest.fixture
def served_app(tmp_path: Path, engine: Engine) -> FastAPI:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(SHELL)
    settings = Settings(
        secret_key=SETTINGS.secret_key, database_url=SETTINGS.database_url, web_dist=dist
    )
    return create_app(
        settings, engine=engine, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    )


@pytest.fixture
def served_client(served_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(served_app) as test_client:
        yield test_client


def api_first_segments(app: FastAPI) -> set[str]:
    return {path.strip("/").split("/", 1)[0] for path in app.openapi()["paths"] if path != "/"}


@pytest.mark.parametrize("headers", [NAVIGATE, HTML_ACCEPT], ids=["fetch-metadata", "accept"])
@pytest.mark.parametrize("suffix", ["", "/12"])
@pytest.mark.parametrize("segment", ROUTE_SEGMENTS)
def test_a_navigation_to_a_route_segment_gets_the_shell(
    served_client: TestClient, segment: str, suffix: str, headers: dict[str, str]
) -> None:
    response = served_client.get(f"/{segment}{suffix}", headers=headers)

    assert response.status_code == 200
    assert response.text == SHELL
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["vary"] == VARY


def test_fetch_metadata_wins_over_a_html_accept(served_client: TestClient) -> None:
    response = served_client.get(
        "/sales", headers={"Sec-Fetch-Mode": "cors", "Accept": "text/html"}
    )

    assert response.text != SHELL
    assert response.status_code == 401


def test_a_html_that_is_not_first_in_accept_is_not_a_navigation(
    served_client: TestClient,
) -> None:
    response = served_client.get("/sales", headers={"Accept": "application/json, text/html"})

    assert response.status_code == 401


def test_every_overlapping_segment_reaches_the_api_without_navigation_headers(
    served_app: FastAPI, served_client: TestClient
) -> None:
    overlapping = sorted(api_first_segments(served_app) & set(ROUTE_SEGMENTS))
    assert overlapping, "the redesign's English routes overlap the API"

    for segment in overlapping:
        for headers in ({}, JSON_ACCEPT, {"Sec-Fetch-Mode": "cors"}):
            response = served_client.get(f"/{segment}", headers=headers)

            assert response.status_code == 401, segment
            assert response.text != SHELL, segment
            assert response.headers["vary"] == VARY, segment


def test_a_signed_in_api_call_still_answers_json_with_the_vary(
    client: TestClient, served_app: FastAPI
) -> None:
    # `client` signs in over its own app (a bearer token, same database); the same token is
    # replayed against the app that serves the front.
    signed_in_headers = {**JSON_ACCEPT, "Authorization": client.headers["Authorization"]}
    with TestClient(served_app) as served:
        response = served.get("/sales", headers=signed_in_headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["vary"] == VARY


@pytest.mark.parametrize("path", ["/sales", "/customers/12", "/login"])
def test_a_navigation_post_is_not_rewritten(served_client: TestClient, path: str) -> None:
    response = served_client.post(path, headers=NAVIGATE)

    assert response.text != SHELL
    assert response.headers["vary"] == VARY


@pytest.mark.parametrize("path", ["/sales/x.js", "/assets/app.js", "/varieties/a.b"])
def test_a_file_like_path_is_not_rewritten(served_client: TestClient, path: str) -> None:
    response = served_client.get(path, headers=NAVIGATE)

    assert response.status_code in {401, 404}
    assert response.text != SHELL


@pytest.mark.parametrize("path", ["/health", "/payments", "/docs"])
def test_paths_outside_the_route_segments_get_no_added_vary(
    served_client: TestClient, path: str
) -> None:
    response = served_client.get(path, headers=NAVIGATE)

    assert "vary" not in response.headers


def test_a_head_navigation_gets_the_shell_headers_and_no_body(
    served_client: TestClient,
) -> None:
    response = served_client.head("/sales/12", headers=NAVIGATE)

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["vary"] == VARY
    assert response.content == b""


def test_a_path_that_merely_starts_like_a_segment_is_not_a_route(
    served_client: TestClient,
) -> None:
    response = served_client.get("/salesman", headers=NAVIGATE)

    assert "vary" not in response.headers

