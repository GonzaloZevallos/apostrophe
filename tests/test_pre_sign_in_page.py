"""The page served before sign-in (docs/adr/0050): its `lang` follows `Accept-Language`
alone, so it is byte-identical for any invitation or reset link in any state.

A `tmp_path` stands in for `web/dist`; the catalogs are the fixture locales, where `de` is a
complete real language and `en-XA` the test locale.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlalchemy.engine import Engine

from app.accounts.adapters.cli import main as accounts_cli
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from app.shared.language import ENGLISH, TEST_LOCALE, Language
from tests.conftest import NOW, PASSWORD, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_LOCALES = Path(__file__).resolve().parent / "fixtures" / "locales"
GERMAN = Language("de")
INDEX = (
    '<!doctype html>\n<html lang="en"><head><script src="/assets/app-1.js"></script></head>'
    "<body>app</body></html>\n"
)
HEADERS = [None, "de", "en-XA", "fr, de;q=0.5", "xx!!", "x" * 5000]


def lang_of(response: Response) -> str:
    found = re.search(r'<html lang="([^"]*)"', response.text)
    assert found is not None
    return found.group(1)


def snapshot(response: Response) -> tuple[int, tuple[tuple[str, str], ...], bytes]:
    return response.status_code, tuple(sorted(response.headers.items())), response.content


def get(client: TestClient, path: str, language: str | None, **extra: str) -> Response:
    headers = dict(extra)
    if language is not None:
        headers["Accept-Language"] = language
    return client.get(path, headers=headers)


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    dist_dir = tmp_path / "dist"
    (dist_dir / "assets").mkdir(parents=True)
    (dist_dir / "index.html").write_text(INDEX, encoding="utf-8")
    (dist_dir / "assets" / "app-1.js").write_text("console.log(1)")
    return dist_dir


def make_client(
    dist: Path,
    engine: Engine,
    clock: MovableClock,
    forced: Language | None = None,
    database_url: str = "sqlite://",
) -> TestClient:
    settings = Settings(
        secret_key="test-secret-key",
        database_url=database_url,
        web_dist=dist,
        locales_dir=FIXTURE_LOCALES,
        selectable_languages=(ENGLISH, GERMAN),
        forced_language=forced,
    )
    return TestClient(
        create_app(
            settings,
            engine=engine,
            clock=clock,
            hasher=TEST_HASHER,
            telegram=FakeTelegram(),
            upkeep_ticker=False,
        )
    )


@pytest.fixture
def client(dist: Path, engine: Engine, clock: MovableClock) -> Iterator[TestClient]:
    with make_client(dist, engine, clock) as test_client:
        yield test_client


@pytest.mark.parametrize("language", [None, "de", "en-XA"])
def test_every_path_that_serves_the_shell_gives_the_same_answer(
    client: TestClient, language: str | None
) -> None:
    answers = {
        snapshot(get(client, "/", language)),
        snapshot(get(client, "/index.html", language)),
        snapshot(get(client, "/sales", language, Accept="text/html")),
        snapshot(get(client, "/some/client/route", language)),
    }

    assert len(answers) == 1


@pytest.mark.parametrize(
    ("header", "lang"),
    [(None, "en"), ("de", "de"), ("de-AT", "de"), ("fr, de;q=0.5", "de"), ("fr", "en")],
)
def test_the_lang_follows_the_header_among_the_selectable_languages(
    client: TestClient, header: str | None, lang: str
) -> None:
    assert lang_of(get(client, "/", header)) == lang


def test_the_page_changes_only_in_the_lang_value(client: TestClient) -> None:
    german = get(client, "/", "de").text

    assert german == INDEX.replace('<html lang="en">', '<html lang="de">')


def test_the_test_locale_in_the_header_gives_english_when_nothing_is_forced(
    client: TestClient,
) -> None:
    assert lang_of(get(client, "/", "en-XA")) == "en"


def test_the_shell_is_never_cached_and_varies_by_language(client: TestClient) -> None:
    response = get(client, "/", "de")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["vary"] == "Accept-Language"
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "etag" not in response.headers
    assert "last-modified" not in response.headers


def test_a_head_answers_the_headers_of_a_get(client: TestClient) -> None:
    got = client.get("/", headers={"Accept-Language": "de"})
    head = client.head("/", headers={"Accept-Language": "de"})

    assert head.status_code == 200
    assert head.content == b""
    assert dict(head.headers) == dict(got.headers)


@pytest.mark.parametrize(
    "header",
    ["xx!!, de", "de;q=1.5", "de;level=1", "x" * 100_000, "de\x00", "fr, " * 400 + "de"],
)
def test_a_bad_header_gives_exactly_the_page_of_no_header(client: TestClient, header: str) -> None:
    bad = get(client, "/", header)

    assert bad.status_code == 200
    assert snapshot(bad) == snapshot(get(client, "/", None))


def test_the_vary_and_no_cache_headers_are_there_with_a_forced_language(
    dist: Path, engine: Engine, clock: MovableClock
) -> None:
    with make_client(dist, engine, clock, forced=TEST_LOCALE) as forced:
        response = get(forced, "/", "de")

    assert lang_of(response) == "en-XA"
    assert response.headers["vary"] == "Accept-Language"
    assert response.headers["cache-control"] == "no-cache"


def test_other_files_keep_their_file_responses(client: TestClient, dist: Path) -> None:
    response = client.get("/assets/app-1.js")

    assert response.status_code == 200
    assert response.headers["etag"]
    assert response.text == "console.log(1)"


def test_a_rebuild_is_served_and_a_bad_file_keeps_the_last_good_page(
    client: TestClient, dist: Path
) -> None:
    index = dist / "index.html"
    before = snapshot(get(client, "/", "de"))

    index.write_text("")
    assert snapshot(get(client, "/", "de")) == before
    index.write_text('<!doctype html>\n<html lang="en">')
    assert snapshot(get(client, "/", "de")) == before

    index.write_text(INDEX.replace("app-1.js", "app-2.js"), encoding="utf-8")
    rebuilt = get(client, "/", "de")

    assert "/assets/app-2.js" in rebuilt.text
    assert lang_of(rebuilt) == "de"


def test_a_failed_reread_logs_nothing(
    client: TestClient, dist: Path, caplog: pytest.LogCaptureFixture
) -> None:
    get(client, "/", None)
    (dist / "index.html").write_text("")

    with caplog.at_level(0):
        get(client, "/", None)

    # The test client logs its own requests; the app logs nothing.
    assert [r for r in caplog.records if r.name != "httpx2"] == []


# --- the sweep: no link, in any state, changes the page ---------------------------------


def _front_paths() -> tuple[str, str]:
    """The invitation and reset front paths, as the web router declares them."""
    routes = (ROOT / "web" / "src" / "routes.ts").read_text(encoding="utf-8")
    paths = {
        name: re.search(rf"export const {name} = '([^']+)'", routes)
        for name in ("INVITATION", "RESET")
    }
    found = {name: match.group(1) for name, match in paths.items() if match is not None}
    assert set(found) == {"INVITATION", "RESET"}
    return found["INVITATION"], found["RESET"]


def _with_token(template: str, token: str) -> str:
    return template.replace(":token", token)


@pytest.fixture
def operator_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url)
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://localhost:8000")
    monkeypatch.delenv("APOSTROPHE_FORCED_LANGUAGE", raising=False)
    return url


def _seed_links(
    client: TestClient,
    capsys: pytest.CaptureFixture[str],
    clock: MovableClock,
) -> dict[str, str]:
    """Front paths for every link state, seeded through the operator's commands and the
    movable clock, never rows."""
    invitation, reset = _front_paths()

    def issue(*command: str) -> str:
        assert accounts_cli(list(command), clock=clock) == 0
        return capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[-1]

    used = issue("invite-business")
    accepted = client.post(
        f"/invitations/{used}/accept",
        json={"business_name": "La Huerta", "email": "ana@example.com", "password": PASSWORD},
    )
    assert accepted.status_code == 201
    expired_invitation = issue("invite-business")
    expired_reset = issue("reset-password", "ana@example.com")
    clock.set(NOW + timedelta(days=8))

    retired = issue("reset-password", "ana@example.com")
    used_reset = issue("reset-password", "ana@example.com")
    submitted = client.post(f"/reset-links/{used_reset}", json={"new_password": PASSWORD + "!"})
    assert submitted.status_code == 200
    live = issue("reset-password", "ana@example.com")
    return {
        "invitation unknown": _with_token(invitation, "unknown-token"),
        "invitation used": _with_token(invitation, used),
        "invitation expired": _with_token(invitation, expired_invitation),
        "reset unknown": _with_token(reset, "unknown-token"),
        "reset retired": _with_token(reset, retired),
        "reset used": _with_token(reset, used_reset),
        "reset live": _with_token(reset, live),
        "reset expired": _with_token(reset, expired_reset),
    }


@pytest.mark.parametrize("forced", [None, TEST_LOCALE])
def test_the_page_is_byte_identical_across_every_link_state(
    forced: Language | None,
    dist: Path,
    operator_database: str,
    capsys: pytest.CaptureFixture[str],
    clock: MovableClock,
) -> None:
    engine = make_engine(operator_database)
    with make_client(dist, engine, clock, forced, operator_database) as client:
        paths = _seed_links(client, capsys, clock)

        for header in HEADERS:
            answers = {state: snapshot(get(client, path, header)) for state, path in paths.items()}
            assert len(set(answers.values())) == 1, header
            assert next(iter(answers.values())) == snapshot(get(client, "/", header))
            if forced is not None:
                assert lang_of(get(client, "/", header)) == "en-XA"


def test_a_header_selecting_a_language_changes_the_page_only_by_that_language(
    dist: Path,
    operator_database: str,
    capsys: pytest.CaptureFixture[str],
    clock: MovableClock,
) -> None:
    engine = make_engine(operator_database)
    with make_client(dist, engine, clock, None, operator_database) as client:
        paths = _seed_links(client, capsys, clock)

        pages = {lang_of(get(client, path, "de")) for path in paths.values()}

    assert pages == {"de"}
