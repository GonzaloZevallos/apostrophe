"""`scripts/backup_copy.main` runs in a public CI log, so whatever it fails with must
name the rule, never the data (CODING_STANDARDS §9): the database URL and the auth
token never reach stdout, stderr or an escaping exception.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import NoSuchModuleError

from scripts.backup_copy import COPY_FAILED, main

URL_SENTINEL = "leaksentinelurl"
TOKEN_SENTINEL = "leaksentineltoken"
USAGE = "usage: backup_copy.py <destination.db>"


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APOSTROPHE_DATABASE_URL", raising=False)
    monkeypatch.delenv("APOSTROPHE_DATABASE_AUTH_TOKEN", raising=False)


def _chain(error: BaseException) -> list[BaseException]:
    seen: list[BaseException] = []
    pending: BaseException | None = error
    while pending is not None and not any(pending is link for link in seen):
        seen.append(pending)
        pending = pending.__cause__ or pending.__context__
    return seen


def test_the_library_quotes_the_dialect_name_of_an_unknown_url() -> None:
    # The premise the leak test below rests on: left unguarded, the library's own
    # exception text carries the URL, so the guard is what keeps it out of the log.
    with pytest.raises(NoSuchModuleError) as raised:
        create_engine(f"nosuchdialect_{URL_SENTINEL}://")

    assert URL_SENTINEL in str(raised.value)


@pytest.mark.parametrize(
    "url_template",
    [
        "sqlite:///{tmp}/" + URL_SENTINEL + "-missing/source.db",
        "nosuchdialect_" + URL_SENTINEL + "://",
    ],
    ids=["missing sqlite directory", "unknown dialect"],
)
def test_a_failed_copy_prints_one_fixed_line_and_leaks_neither_url_nor_token(
    url_template: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
) -> None:
    """The token check is a guard only: no stock exception on this path carries the
    token, so only the URL sentinel can be seen leaking from the library."""
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url_template.format(tmp=tmp_path))
    monkeypatch.setenv("APOSTROPHE_DATABASE_AUTH_TOKEN", TOKEN_SENTINEL)
    escaped: BaseException | None = None

    try:
        code = main([str(tmp_path / "out.db")])
    except BaseException as exc:
        escaped = exc
        code = None
    captured = capfd.readouterr()

    if escaped is not None:
        for link in _chain(escaped):
            for sentinel in (URL_SENTINEL, TOKEN_SENTINEL):
                for rendering in (str(link), repr(link)):
                    assert sentinel not in rendering, (
                        f"{sentinel} leaked through {type(link).__name__}"
                    )
    assert escaped is None, f"{type(escaped).__name__} escaped main"
    assert code == 1
    assert captured.out == ""
    assert captured.err.endswith(COPY_FAILED + "\n")
    assert captured.err.count(COPY_FAILED) == 1
    assert URL_SENTINEL not in captured.err
    assert TOKEN_SENTINEL not in captured.err


def test_a_missing_database_url_prints_the_fixed_line(
    capfd: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    code = main([str(tmp_path / "out.db")])

    captured = capfd.readouterr()
    assert code == 1
    assert captured.out == ""
    assert captured.err == COPY_FAILED + "\n"


@pytest.mark.parametrize("argv", [[], ["one.db", "two.db"]], ids=["no arguments", "two arguments"])
def test_a_wrong_number_of_arguments_is_a_usage_error(
    argv: list[str], capfd: pytest.CaptureFixture[str]
) -> None:
    code = main(argv)

    captured = capfd.readouterr()
    assert code == 2
    assert USAGE in captured.err


def test_a_successful_copy_returns_zero_and_writes_nothing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capfd: pytest.CaptureFixture[str],
) -> None:
    source_path = tmp_path / "source.db"
    source = sqlite3.connect(source_path)
    source.execute('CREATE TABLE "things" ("id", "name")')
    source.executemany('INSERT INTO "things" VALUES (?, ?)', [(1, "a"), (2, "b")])
    source.commit()
    source.close()
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{source_path}")
    destination_path = tmp_path / "out.db"

    code = main([str(destination_path)])

    captured = capfd.readouterr()
    assert code == 0
    assert captured.err == ""
    destination = sqlite3.connect(destination_path)
    try:
        rows = destination.execute('SELECT "id", "name" FROM "things" ORDER BY "id"').fetchall()
    finally:
        destination.close()
    assert rows == [(1, "a"), (2, "b")]
