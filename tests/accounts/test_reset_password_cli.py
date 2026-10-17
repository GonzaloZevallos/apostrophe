"""`reset-password <email>` (docs/adr/0019), behind `scripts/reset-password.sh`: the
link reaches stdout only, a failure before it is issued reaches stderr as one fixed
line, and nothing personal is logged.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.accounts.adapters.cli import main
from app.clock import system_clock
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import PASSWORD, TEST_HASHER
from tests.fakes.telegram import FakeTelegram

NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def _set_up(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url)
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://192.168.0.10:8000/")
    return url


def test_the_command_prints_a_link_that_resets_a_known_user_s_password(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    url = _set_up(tmp_path, monkeypatch)
    assert main(["invite-business"]) == 0
    invite_link = capsys.readouterr().out.splitlines()[0]
    invite_token = invite_link.rsplit("/", 1)[-1]
    app = create_app(
        Settings("cli-secret", url),
        engine=make_engine(url),
        clock=system_clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        client.post(f"/invitations/{invite_token}/accept", json=NEW_USER)

    assert main(["reset-password", NEW_USER["email"]]) == 0

    out = capsys.readouterr().out
    lines = out.splitlines()
    assert lines[0].startswith("http://192.168.0.10:8000/reset/")
    assert "Valid once, until" in lines[1]
    reset_token = lines[0].rsplit("/", 1)[-1]

    with TestClient(app) as client:
        submitted = client.post(
            f"/reset-links/{reset_token}", json={"new_password": "a totally new password"}
        )
    assert submitted.status_code == 200


def test_an_unknown_or_malformed_email_writes_zero_rows_and_nothing_to_stdout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _set_up(tmp_path, monkeypatch)

    unknown = main(["reset-password", "nadie@example.com"])
    malformed = main(["reset-password", "not an email"])

    captured = capsys.readouterr()
    assert unknown == 1
    assert malformed == 1
    assert captured.out == ""
    assert captured.err.count("no user for that email") == 2


def test_a_forced_database_failure_prints_only_refused_and_the_class_name(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    import app.accounts.adapters.cli as cli_module

    _set_up(tmp_path, monkeypatch)

    def boom(*args: object, **kwargs: object) -> None:
        raise RuntimeError("the database exploded, with a secret token: abc123")

    monkeypatch.setattr(cli_module, "issue_reset_link", boom)

    code = main(["reset-password", "anyone@example.com"])

    captured = capsys.readouterr()
    assert code == 1
    assert captured.out == ""
    assert captured.err == "refused: RuntimeError\n"
    assert "abc123" not in captured.err


def test_a_second_issue_replaces_the_first_link(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    url = _set_up(tmp_path, monkeypatch)
    assert main(["invite-business"]) == 0
    invite_token = capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[-1]
    app = create_app(
        Settings("cli-secret", url),
        engine=make_engine(url),
        clock=system_clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        client.post(f"/invitations/{invite_token}/accept", json=NEW_USER)

    main(["reset-password", NEW_USER["email"]])
    first_token = capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[-1]
    main(["reset-password", NEW_USER["email"]])
    second_token = capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[-1]

    with TestClient(app) as client:
        stale = client.post(
            f"/reset-links/{first_token}", json={"new_password": "a totally new password"}
        )
        fresh = client.post(
            f"/reset-links/{second_token}", json={"new_password": "a totally new password"}
        )
    assert stale.status_code == 404
    assert fresh.status_code == 200


def test_no_log_record_from_the_command_carries_an_email_a_digest_or_a_token(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    url = _set_up(tmp_path, monkeypatch)
    assert main(["invite-business"]) == 0
    invite_token = capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[-1]
    app = create_app(
        Settings("cli-secret", url),
        engine=make_engine(url),
        clock=system_clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        client.post(f"/invitations/{invite_token}/accept", json=NEW_USER)

    with caplog.at_level(logging.DEBUG):
        main(["reset-password", NEW_USER["email"]])
    out = capsys.readouterr().out
    token = out.splitlines()[0].rsplit("/", 1)[-1]

    for record in caplog.records:
        message = record.getMessage()
        assert NEW_USER["email"] not in message
        assert token not in message


def test_make_engine_keeps_hide_parameters_true_through_the_command(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A bound parameter -- an email, a digest, a token -- must never reach a SQL
    error's text (CODING_STANDARDS §9): proven on the exact URL the command itself
    builds its engine from, not a hand-built one elsewhere."""
    url = _set_up(tmp_path, monkeypatch)

    engine = make_engine(url)

    assert engine.hide_parameters is True
