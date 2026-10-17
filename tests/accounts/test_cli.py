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


def test_the_command_prints_a_link_that_opens_a_business(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url)
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://192.168.0.10:8000/")

    assert main(["invite-business"]) == 0

    link = capsys.readouterr().out.splitlines()[0]
    assert link.startswith("http://192.168.0.10:8000/invitation/")
    token = link.rsplit("/", 1)[-1]
    app = create_app(
        Settings("cli-secret", url),
        engine=make_engine(url),
        clock=system_clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        accepted = client.post(f"/invitations/{token}/accept", json=NEW_USER)
    assert accepted.status_code == 201
