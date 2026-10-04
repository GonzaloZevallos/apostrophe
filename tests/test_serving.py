"""The built front (`web/dist`) is served next to the API, and nothing outside it is
reachable by any path (CODING_STANDARDS §8; Tech Lead's plan, static serving).

A fresh `tmp_path` stands in for `web/dist`: an `index.html` inside it, a secret file
right next to it (outside the served directory) and a symlink inside it that points at
that secret. The mount must never answer with the secret's contents, whatever the path.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.main import create_app
from app.settings import Settings
from app.static_spa import MissingBuiltFront
from tests.conftest import SETTINGS, TEST_HASHER
from tests.fakes.telegram import FakeTelegram

SECRET = "sv-secret-only-outside-dist"


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<html>the app shell</html>")
    assets = dist_dir / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('ok')")
    secret_file = tmp_path / "secret.txt"
    secret_file.write_text(SECRET)
    (dist_dir / "escape").symlink_to(secret_file)
    return dist_dir


@pytest.fixture
def served_app(dist: Path, engine: Engine) -> FastAPI:
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


@pytest.mark.parametrize("escape", ["../secret.txt", "..%2fsecret.txt", "%2e%2e/secret.txt"])
def test_traversal_never_reaches_the_secret(served_client: TestClient, escape: str) -> None:
    response = served_client.get(f"/{escape}")

    assert SECRET not in response.text


def test_a_symlink_pointing_out_of_dist_is_not_followed(served_client: TestClient) -> None:
    # Not found under `dist` (the symlink is rejected before it is ever read), so the
    # SPA fallback takes over, the same as any other unknown extension-less path.
    response = served_client.get("/escape")

    assert SECRET not in response.text
    assert "the app shell" in response.text


@pytest.mark.parametrize("path", ["/clientes/3", "/invitation/abc"])
def test_a_front_route_answers_the_app_shell(served_client: TestClient, path: str) -> None:
    response = served_client.get(path)

    assert response.status_code == 200
    assert "the app shell" in response.text


def test_an_unmatched_api_path_stays_the_plain_json_404(served_client: TestClient) -> None:
    response = served_client.get("/customers/1/typo")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_a_missing_asset_is_a_plain_404_not_the_app_shell(served_client: TestClient) -> None:
    response = served_client.get("/assets/missing.js")

    assert response.status_code == 404
    assert "the app shell" not in response.text


def test_static_serving_adds_no_path_to_the_openapi_document(
    served_app: FastAPI, engine: Engine
) -> None:
    unserved = create_app(
        SETTINGS, engine=engine, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    )

    assert served_app.openapi()["paths"] == unserved.openapi()["paths"]


@pytest.mark.parametrize("path", ["/index.html", "/manifest.webmanifest", "/sw.js"])
def test_index_manifest_and_service_worker_are_never_cached(
    served_client: TestClient, dist: Path, path: str
) -> None:
    (dist / "manifest.webmanifest").write_text("{}")
    (dist / "sw.js").write_text("")

    response = served_client.get(path)

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"


def test_startup_fails_without_an_index_html(tmp_path: Path, engine: Engine) -> None:
    empty_dist = tmp_path / "empty"
    empty_dist.mkdir()
    settings = Settings(
        secret_key=SETTINGS.secret_key, database_url=SETTINGS.database_url, web_dist=empty_dist
    )

    with pytest.raises(MissingBuiltFront):
        create_app(
            settings,
            engine=engine,
            hasher=TEST_HASHER,
            telegram=FakeTelegram(),
            upkeep_ticker=False,
        )
