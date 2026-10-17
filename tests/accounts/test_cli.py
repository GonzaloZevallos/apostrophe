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
