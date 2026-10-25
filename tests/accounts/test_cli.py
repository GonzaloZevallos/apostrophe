from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.accounts.adapters.cli import main
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, PASSWORD, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram

CLOCK = MovableClock(NOW)  # the CLI and the app under test share one clock
NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def test_the_command_prints_a_link_that_opens_a_business(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url)
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://192.168.0.10:8000/")

    assert main(["invite-business"], clock=CLOCK) == 0

    link = capsys.readouterr().out.splitlines()[0]
    assert link.startswith("http://192.168.0.10:8000/invitation/")
    token = link.rsplit("/", 1)[-1]
    app = create_app(
        Settings("cli-secret", url),
        engine=make_engine(url),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
        clock=CLOCK,
    )
    with TestClient(app) as client:
        accepted = client.post(f"/invitations/{token}/accept", json=NEW_USER)
    assert accepted.status_code == 201


def test_the_printed_expiry_is_seven_days_after_the_clock_it_was_given(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url)
    instant = datetime(2031, 5, 4, 9, 30, tzinfo=UTC)

    assert main(["invite-business"], clock=MovableClock(instant)) == 0

    expiry = capsys.readouterr().out.splitlines()[1]
    assert expiry == f"Valid once, until {instant + timedelta(days=7):%Y-%m-%d %H:%M} UTC."


FIXTURE_LOCALES = Path(__file__).resolve().parents[1] / "fixtures" / "locales"


def test_an_invalid_forced_language_prints_only_refused_invalid_setting(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path / 'apostrophe.db'}")
    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "de")

    assert main(["invite-business"], clock=CLOCK) == 1
    captured = capsys.readouterr()

    assert captured.err == "refused: InvalidSetting\n"
    assert captured.out == ""
    assert not (tmp_path / "apostrophe.db").exists()


def test_a_line_the_translator_cannot_render_prints_refused_and_its_class_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    broken = Settings("cli-secret", url, locales_dir=FIXTURE_LOCALES)
    monkeypatch.setattr(Settings, "from_env", classmethod(lambda cls: broken))

    assert main(["invite-business"], clock=CLOCK) == 1

    captured = capsys.readouterr()
    assert captured.err == "refused: MissingOperatorKey\n"
    assert captured.out == ""


def test_the_forced_test_locale_wraps_the_expiry_line_and_keeps_its_data(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path / 'apostrophe.db'}")
    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "en-XA")
    instant = datetime(2031, 5, 4, 9, 30, tzinfo=UTC)

    assert main(["invite-business"], clock=MovableClock(instant)) == 0

    expiry = capsys.readouterr().out.splitlines()[1]
    assert expiry.startswith("⟦") and expiry.endswith("⟧")
    assert "2031-05-11 09:30" in expiry


def test_reset_password_for_an_unknown_email_prints_the_translated_no_user_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path / 'apostrophe.db'}")
    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "en-XA")

    assert main(["reset-password", "nadie@example.com"], clock=CLOCK) == 1

    err = capsys.readouterr().err
    assert err.startswith("⟦") and err != "no user for that email\n"
