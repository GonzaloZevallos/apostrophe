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
from app.static_spa import (
    LEGACY_FRONT_PATHS_FILE,
    SHARED_FRONT_PATHS,
    MissingBuiltFront,
)
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram
from tests.legacy_pin import PINNED_LEGACY_ROWS

SECRET = "sv-secret-only-outside-dist"


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text('<html lang="en">the app shell</html>')
    assets = dist_dir / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('ok')")
    secret_file = tmp_path / "secret.txt"
    secret_file.write_text(SECRET)
    (dist_dir / "escape").symlink_to(secret_file)
    return dist_dir


@pytest.fixture
def served_app(dist: Path, engine: Engine, clock: MovableClock) -> FastAPI:
    settings = Settings(
        secret_key=SETTINGS.secret_key, database_url=SETTINGS.database_url, web_dist=dist
    )
    return create_app(
        settings,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
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


@pytest.mark.parametrize("path", ["/login", "/invitation/abc", "/reset/abc"])
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
    served_app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    unserved = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
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


def test_startup_fails_without_an_index_html(
    tmp_path: Path, engine: Engine, clock: MovableClock
) -> None:
    empty_dist = tmp_path / "empty"
    empty_dist.mkdir()
    settings = Settings(
        secret_key=SETTINGS.secret_key, database_url=SETTINGS.database_url, web_dist=empty_dist
    )

    with pytest.raises(MissingBuiltFront):
        create_app(
            settings,
            engine=engine,
            clock=clock,
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


def test_a_shared_front_path_is_the_shell_only_for_a_browser_navigation(
    served_client: TestClient,
) -> None:
    # One app, every cell of the grid: building an app per cell made the suite crawl.
    for path, method, accept, slash in SHARED_CELLS:
        response = _request(served_client, method, path + ("/" if slash else ""), accept)

        cell = (path, method, accept, slash)
        outcome = SHARED_OUTCOME[(method, accept, slash)]
        if outcome == SHELL:
            assert response.status_code == 200, cell
            assert response.headers["content-type"].startswith("text/html"), cell
            assert method == "HEAD" or "the app shell" in response.text, cell
        elif outcome == REDIRECT:
            assert response.status_code == 308, cell
            assert response.headers["location"] == path, cell
        else:
            assert response.status_code == API_STATUS[(path, method, slash)], cell
            assert "the app shell" not in response.text, cell
            assert "location" not in response.headers, cell


# The expected target of every row is the hand-written fixture's
# (`tests/fixtures/legacy_front_paths.json`, read through `tests/legacy_pin.py`), never the
# app's own file's: a wrong target in `app/legacy_front_paths.json` fails here. That the
# app holds exactly these rows is `tests/test_static_spa.py`'s to check. An id is carried
# across: `{id}` is 4821.
LEGACY_CASES = [
    (old.replace("{id}", "4821"), now.replace("{id}", "4821")) for old, now in PINNED_LEGACY_ROWS
]


@pytest.mark.parametrize(("legacy", "target"), LEGACY_CASES)
def test_a_legacy_spanish_path_redirects_permanently_whatever_the_request(
    served_client: TestClient, legacy: str, target: str
) -> None:
    # One app per row, many cheap requests: the whole grid of method, Accept, trailing
    # slash and query string, so each row is tested one by one without 700 app builds.
    for method in ("GET", "HEAD", "POST", "OPTIONS"):
        for accept in (HTML, JSON, ANY):
            for slash in (False, True):
                response = _request(served_client, method, legacy + ("/" if slash else ""), accept)
                assert response.status_code == 308, (method, accept, slash)
                assert response.headers["location"] == target, (method, accept, slash)
    for slash in (False, True):
        response = _request(
            served_client, "GET", legacy + ("/" if slash else ""), HTML, "?month=2026-09&x=%C3%B1"
        )
        assert response.headers["location"] == f"{target}?month=2026-09&x=%C3%B1"


def test_the_app_finds_the_legacy_rows_at_their_shipped_path(
    served_client: TestClient,
) -> None:
    shipped = Path(__file__).resolve().parent.parent / "app" / "legacy_front_paths.json"

    assert LEGACY_FRONT_PATHS_FILE == shipped
    assert shipped.is_file()
    response = _request(served_client, "GET", "/variedades/7", HTML)
    assert response.status_code == 308
    assert response.headers["location"] == "/varieties/7"


def test_an_unmatched_spanish_path_is_not_redirected(served_client: TestClient) -> None:
    for path in (
        "/ventas/basura",
        "/ventas/7/basura",
        "/clientes/7/borrar",
        "/clientes/nuevo/7",
        "/mi-stock/entradas",
        "/mi-stock/entradas/abc",
        "/gastos/categorias/7",
        "/variedades/abc",
        "/negocio/otro",
    ):
        response = _request(served_client, "GET", path, HTML)

        assert response.status_code == 200, path
        assert "the app shell" in response.text, path
    assert "location" not in response.headers


# What a shared template with {id} = 7 is, concretely: `/sales/{id}` -> `/sales/7`.
SHARED_CONCRETE = sorted(path.replace("{id}", "7") for path in SHARED_FRONT_PATHS)


def test_the_shared_list_is_the_one_the_plan_names() -> None:
    assert sorted(SHARED_FRONT_PATHS) == sorted(
        [
            "/sales",
            "/sales/new",
            "/sales/{id}",
            "/customers",
            "/customers/new",
            "/customers/{id}",
            "/customers/{id}/edit",
            "/customers/{id}/payment",
            "/varieties",
            "/varieties/new",
            "/varieties/archived",
            "/varieties/{id}",
            "/varieties/{id}/prices",
            "/varieties/{id}/prices/new",
            "/varieties/{id}/entries",
            "/varieties/catalog",
            "/varieties/entries",
            "/varieties/entries/new",
            "/varieties/entries/{id}",
            "/expenses",
            "/expenses/new",
            "/analysis",
        ]
    )


def test_a_shared_template_is_the_shell_for_a_navigation(served_client: TestClient) -> None:
    browser_accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

    for path in SHARED_CONCRETE:
        response = _request(served_client, "GET", path, browser_accept, "?month=2026-09")

        assert response.status_code == 200, path
        assert response.headers["content-type"].startswith("text/html"), path
        assert "the app shell" in response.text, path


def test_a_shared_template_plus_one_slash_is_a_308_to_the_slashless_path(
    served_client: TestClient,
) -> None:
    for path in SHARED_CONCRETE:
        response = _request(served_client, "GET", path + "/", HTML, "?a=1")

        assert response.status_code == 308, path
        assert response.headers["location"] == f"{path}?a=1", path


def _assert_the_api_answered(through_the_front: Response, api_alone: Response) -> None:
    """The request reached the API, not the shell: where the API alone has a GET route its
    answer is the same, byte for byte; where it has none, the app that also mounts the
    front says 404 instead of 405, and either way it is JSON, never the shell."""
    assert "the app shell" not in through_the_front.text
    assert "location" not in through_the_front.headers
    if api_alone.status_code in (404, 405):
        assert through_the_front.status_code in (404, 405)
    else:
        assert through_the_front.status_code == api_alone.status_code
        assert through_the_front.json() == api_alone.json()


def test_a_json_request_to_a_shared_path_reaches_the_api_signed_out(
    served_client: TestClient, anonymous_client: TestClient
) -> None:
    for accept in (JSON, ANY):
        for path in SHARED_CONCRETE:
            through_the_front = _request(served_client, "GET", path, accept)
            api_alone = _request(anonymous_client, "GET", path, accept)

            _assert_the_api_answered(through_the_front, api_alone)


def test_a_json_request_to_a_shared_path_reaches_the_api_signed_in(
    served_client: TestClient, client: TestClient
) -> None:
    served_client.headers["Authorization"] = client.headers["Authorization"]

    for path in SHARED_CONCRETE:
        through_the_front = _request(served_client, "GET", path, JSON)
        api_alone = _request(client, "GET", path, JSON)

        _assert_the_api_answered(through_the_front, api_alone)


def test_a_path_the_template_does_not_match_is_not_the_shell(
    served_client: TestClient,
) -> None:
    for path in ("/sales/abc", "/customers/new/7", "/varieties/entries/abc"):
        response = _request(served_client, "GET", path, HTML)

        assert "the app shell" not in response.text, path


def test_a_shared_path_is_never_the_shell_for_a_method_that_is_not_a_navigation(
    served_client: TestClient,
) -> None:
    for method in ("POST", "PUT", "DELETE", "OPTIONS"):
        for path in SHARED_CONCRETE:
            response = _request(served_client, method, path, HTML)

            assert "the app shell" not in response.text, (method, path)
            assert response.status_code != 308, (method, path)


def test_a_new_front_path_with_no_api_segment_is_served_through_the_mount(
    served_client: TestClient,
) -> None:
    response = _request(served_client, "GET", "/settings/expense-categories", HTML)

    assert response.status_code == 200
    assert "the app shell" in response.text


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


def test_a_double_trailing_slash_on_a_legacy_path_is_not_redirected(
    served_client: TestClient,
) -> None:
    for path in ("/mas/", "/gastos/"):
        response = _request(served_client, "GET", path + "/", HTML)

        assert response.status_code != 308, path


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


# --- Parameterised shared paths and shared templates (docs/adr/0033) -----------------------

SHARED_FRONT_ROUTES: list[str] = sorted(
    path.replace("{id}", "7")
    for path in SHARED_FRONT_PATHS
    if path.startswith(("/varieties", "/expenses"))
)


@pytest.mark.parametrize("method", ["GET", "HEAD"])
@pytest.mark.parametrize("path", SHARED_FRONT_ROUTES)
def test_every_shared_front_route_in_the_contract_is_the_shell_for_a_navigation(
    served_client: TestClient, path: str, method: str
) -> None:
    response = _request(served_client, method, path, HTML)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert method == "HEAD" or "the app shell" in response.text


@pytest.mark.parametrize("path", SHARED_FRONT_ROUTES)
def test_every_shared_front_route_in_the_contract_reaches_the_api_for_json(
    served_client: TestClient, path: str
) -> None:
    response = _request(served_client, "GET", path, JSON)

    assert "the app shell" not in response.text
    assert response.status_code in (401, 404)
    assert response.headers["content-type"].startswith("application/json")


def test_a_gated_api_route_under_a_shared_path_answers_401_signed_out_for_json(
    served_client: TestClient,
) -> None:
    for path in ("/varieties/7", "/varieties/7/prices", "/varieties"):
        assert _request(served_client, "GET", path, JSON).status_code == 401


@pytest.mark.parametrize("path", ["/varieties/7/prices", "/varieties/entries/7"])
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_a_write_to_a_parameterised_shared_path_is_never_the_shell(
    served_client: TestClient, path: str, method: str
) -> None:
    response = _request(served_client, method, path, HTML)

    assert "the app shell" not in response.text


@pytest.mark.parametrize(
    "path",
    [
        "/varieties/7a",
        "/varieties/a7",
        "/varieties/-7",
        "/varieties/7/entries/x",
        "/varieties/entries/7a",
        "/varieties/7/prices/new/x",
        "/varieties/7/prices/7",
        "/varieties/entries/7/x",
        "/varieties/7%0A",
        "/varieties/%0A7",
        "/varieties//7",
        "/varieties/7//",
        "/varieties/٧",
    ],
)
def test_a_near_miss_of_a_shared_pattern_is_never_the_shell(
    served_client: TestClient, path: str
) -> None:
    response = _request(served_client, "GET", path, HTML)

    assert "the app shell" not in response.text


@pytest.mark.parametrize(
    ("path", "target"),
    [
        ("/varieties/7/", "/varieties/7"),
        ("/varieties/7/prices/", "/varieties/7/prices"),
        ("/varieties/entries/7/", "/varieties/entries/7"),
        ("/varieties/catalog/", "/varieties/catalog"),
    ],
)
def test_a_shared_path_with_one_trailing_slash_is_a_308_to_the_slashless_path(
    served_client: TestClient, path: str, target: str
) -> None:
    response = _request(served_client, "GET", path, HTML, "?a=1")

    assert response.status_code == 308
    assert response.headers["location"] == f"{target}?a=1"


def test_a_head_navigation_to_a_slashed_shared_path_is_a_308_too(
    served_client: TestClient,
) -> None:
    response = _request(served_client, "HEAD", "/varieties/7/prices/", HTML)

    assert response.status_code == 308
    assert response.headers["location"] == "/varieties/7/prices"


@pytest.mark.parametrize(("method", "accept"), [("GET", JSON), ("POST", HTML), ("DELETE", HTML)])
def test_a_slashed_shared_path_is_redirected_only_for_a_html_navigation(
    served_client: TestClient, method: str, accept: str
) -> None:
    response = _request(served_client, method, "/varieties/7/", accept)

    assert response.status_code != 308
    assert "the app shell" not in response.text


@pytest.mark.parametrize("path", ["/onboarding", "/onboarding/variety", "/onboarding/done"])
def test_an_onboarding_front_path_is_the_shell_for_a_navigation(
    served_client: TestClient, path: str
) -> None:
    response = _request(served_client, "GET", path, HTML)

    assert response.status_code == 200
    assert "the app shell" in response.text


def test_the_onboarding_progress_api_is_never_the_shell(served_client: TestClient) -> None:
    for accept in (JSON, HTML):
        response = _request(served_client, "GET", "/onboarding-progress", accept)

        assert response.status_code == 401
        assert "the app shell" not in response.text
