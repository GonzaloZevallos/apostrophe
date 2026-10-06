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
from httpx2 import Response
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


# --- Front navigation: shared front paths and legacy 308s (docs/adr/0024) ----------------

SHELL = "shell"
REDIRECT = "308"
API = "api"

HTML = "text/html"
JSON = "application/json"
ANY = "*/*"

# What a request to a path both the front and the API's router name (`/expenses`,
# `/expenses/new`) gets, by (method, Accept, trailing slash): only a GET or HEAD asking
# for text/html is the shell (or, with a trailing slash, the 308 to the slashless path);
# every other cell is the API's own answer, as before this layer existed.
SHARED_OUTCOME: dict[tuple[str, str, bool], str] = {
    ("GET", HTML, False): SHELL,
    ("GET", JSON, False): API,
    ("GET", ANY, False): API,
    ("GET", HTML, True): REDIRECT,
    ("GET", JSON, True): API,
    ("GET", ANY, True): API,
    ("HEAD", HTML, False): SHELL,
    ("HEAD", JSON, False): API,
    ("HEAD", ANY, False): API,
    ("HEAD", HTML, True): REDIRECT,
    ("HEAD", JSON, True): API,
    ("HEAD", ANY, True): API,
    ("POST", HTML, False): API,
    ("POST", JSON, False): API,
    ("POST", ANY, False): API,
    ("POST", HTML, True): API,
    ("POST", JSON, True): API,
    ("POST", ANY, True): API,
    ("OPTIONS", HTML, False): API,
    ("OPTIONS", JSON, False): API,
    ("OPTIONS", ANY, False): API,
    ("OPTIONS", HTML, True): API,
    ("OPTIONS", JSON, True): API,
    ("OPTIONS", ANY, True): API,
}

# The API's own status for each `API` cell above, measured on the app without this
# layer: `/expenses` has a GET and a POST route (gated, so 401 signed out), `/expenses/new`
# has none, and the static mount answers a GET/HEAD it cannot serve under an API segment
# with a 404.
API_STATUS: dict[tuple[str, str, bool], int] = {
    ("/expenses", "GET", False): 401,
    ("/expenses", "GET", True): 404,
    ("/expenses", "HEAD", False): 404,
    ("/expenses", "HEAD", True): 404,
    ("/expenses", "POST", False): 401,
    ("/expenses", "POST", True): 405,
    ("/expenses", "OPTIONS", False): 405,
    ("/expenses", "OPTIONS", True): 405,
    ("/expenses/new", "GET", False): 404,
    ("/expenses/new", "GET", True): 404,
    ("/expenses/new", "HEAD", False): 404,
    ("/expenses/new", "HEAD", True): 404,
    ("/expenses/new", "POST", False): 405,
    ("/expenses/new", "POST", True): 405,
    ("/expenses/new", "OPTIONS", False): 405,
    ("/expenses/new", "OPTIONS", True): 405,
}

SHARED_CELLS = [
    (path, method, accept, slash)
    for path in ("/expenses", "/expenses/new")
    for (method, accept, slash) in SHARED_OUTCOME
]


def _request(
    client: TestClient, method: str, path: str, accept: str, query: str = ""
) -> Response:
    return client.request(method, path + query, headers={"Accept": accept}, follow_redirects=False)


@pytest.mark.parametrize(("path", "method", "accept", "slash"), SHARED_CELLS)
def test_a_shared_front_path_is_the_shell_only_for_a_browser_navigation(
    served_client: TestClient, path: str, method: str, accept: str, slash: bool
) -> None:
    response = _request(served_client, method, path + ("/" if slash else ""), accept)

    outcome = SHARED_OUTCOME[(method, accept, slash)]
    if outcome == SHELL:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert method == "HEAD" or "the app shell" in response.text
    elif outcome == REDIRECT:
        assert response.status_code == 308
        assert response.headers["location"] == path
    else:
        assert response.status_code == API_STATUS[(path, method, slash)]
        assert "the app shell" not in response.text
        assert "location" not in response.headers


LEGACY_TARGETS = {"/mas": "/more", "/gastos": "/expenses"}


@pytest.mark.parametrize("slash", [False, True])
@pytest.mark.parametrize("accept", [HTML, JSON, ANY])
@pytest.mark.parametrize("method", ["GET", "HEAD", "POST", "OPTIONS"])
@pytest.mark.parametrize("legacy", sorted(LEGACY_TARGETS))
def test_a_legacy_spanish_path_redirects_permanently_whatever_the_request(
    served_client: TestClient, legacy: str, method: str, accept: str, slash: bool
) -> None:
    response = _request(served_client, method, legacy + ("/" if slash else ""), accept)

    assert response.status_code == 308
    assert response.headers["location"] == LEGACY_TARGETS[legacy]


@pytest.mark.parametrize("legacy", sorted(LEGACY_TARGETS))
def test_the_query_string_is_kept_on_a_legacy_redirect(
    served_client: TestClient, legacy: str
) -> None:
    response = _request(served_client, "GET", legacy, HTML, "?month=2026-09&x=%C3%B1")

    assert response.headers["location"] == f"{LEGACY_TARGETS[legacy]}?month=2026-09&x=%C3%B1"


def test_the_query_string_is_kept_on_a_trailing_slash_redirect(
    served_client: TestClient,
) -> None:
    response = _request(served_client, "GET", "/expenses/", HTML, "?month=2026-09")

    assert response.status_code == 308
    assert response.headers["location"] == "/expenses?month=2026-09"


def test_a_shared_front_path_with_a_query_string_is_the_shell(
    served_client: TestClient,
) -> None:
    response = _request(served_client, "GET", "/expenses", HTML, "?month=2026-09")

    assert response.status_code == 200
    assert "the app shell" in response.text


def test_a_browser_s_own_accept_header_gets_the_shell(served_client: TestClient) -> None:
    browser_accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

    response = _request(served_client, "GET", "/expenses/new", browser_accept)

    assert response.status_code == 200
    assert "the app shell" in response.text


def test_an_expense_id_path_is_not_the_shell(served_client: TestClient) -> None:
    response = _request(served_client, "GET", "/expenses/5", HTML)

    assert "the app shell" not in response.text


@pytest.mark.parametrize("path", ["/gastos/categorias", "/gastos/categorias/"])
def test_the_categories_screen_keeps_answering_the_shell_through_the_mount(
    served_client: TestClient, path: str
) -> None:
    response = _request(served_client, "GET", path, HTML)

    assert response.status_code == 200
    assert "the app shell" in response.text


@pytest.mark.parametrize("path", ["/mas/", "/gastos/"])
def test_a_double_trailing_slash_on_a_legacy_path_is_not_redirected(
    served_client: TestClient, path: str
) -> None:
    response = _request(served_client, "GET", path + "/", HTML)

    assert response.status_code != 308


def test_the_shell_on_a_shared_path_carries_the_same_headers_as_the_root(
    served_client: TestClient,
) -> None:
    volatile = {"date", "etag", "last-modified"}

    root = _request(served_client, "GET", "/", HTML)
    shared = _request(served_client, "GET", "/expenses", HTML)

    def comparable(response: Response) -> dict[str, str]:
        return {k: v for k, v in response.headers.items() if k not in volatile}

    assert comparable(shared) == comparable(root)
    assert shared.headers["cache-control"] == "no-cache"
