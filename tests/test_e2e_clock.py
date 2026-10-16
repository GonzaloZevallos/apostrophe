"""The e2e backend's anchored clock (GH-251, docs/adr/0043): the e2e run starts from a fixed
instant and keeps advancing, whatever the real date is."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.clock import business_day
from tests import e2e_app
from tests.conftest import PASSWORD, MovableClock
from tests.e2e_app import (
    ANCHOR,
    CLOCK_OFFSET_VARIABLE,
    anchored_clock,
    create_e2e_app,
    main,
    offset_seconds,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
REAL_DAY = datetime(2027, 11, 20, 1, 30, tzinfo=UTC)


def test_anchored_clock_starts_at_the_anchor_and_advances_across_argentina_midnight() -> None:
    real = MovableClock(REAL_DAY)
    clock = anchored_clock(timedelta(seconds=offset_seconds(real)), real)

    assert clock() == ANCHOR
    real.set(REAL_DAY + timedelta(hours=11))  # 12:00 -> 23:00 in Argentina
    assert business_day(clock()).isoformat() == "2026-10-07"
    real.set(REAL_DAY + timedelta(hours=13))
    assert clock() == ANCHOR + timedelta(hours=13)
    assert business_day(clock()).isoformat() == "2026-10-08"


def test_offset_seconds_is_the_whole_seconds_from_the_source_to_the_anchor() -> None:
    source = MovableClock(ANCHOR - timedelta(days=1, seconds=5, milliseconds=300))

    assert offset_seconds(source) == 86_406
    assert offset_seconds(MovableClock(ANCHOR + timedelta(seconds=30))) == -30


@pytest.fixture
def e2e_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("APOSTROPHE_E2E_PARENT_PID", raising=False)
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k" * 32)
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path}/e2e.db")
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://localhost:9")


def _invitation_token(capsys: pytest.CaptureFixture[str]) -> tuple[str, str]:
    assert main(["invite-business"]) == 0
    out = capsys.readouterr().out
    link = out.splitlines()[0]
    return link.rsplit("/", 1)[1], out


def test_the_app_runs_on_the_anchored_clock_when_the_offset_is_set(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv(CLOCK_OFFSET_VARIABLE, str(offset_seconds()))
    token, _ = _invitation_token(capsys)

    with TestClient(create_e2e_app()) as client:
        accepted = client.post(
            f"/invitations/{token}/accept",
            json={"business_name": "Anclado", "email": "a@example.com", "password": PASSWORD},
        )
        assert accepted.status_code == 201, accepted.text
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {accepted.json()['token']}"})

    assert me.json()["today"] == "2026-10-07"


def test_the_app_uses_the_real_clock_when_the_offset_is_unset(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv(CLOCK_OFFSET_VARIABLE, raising=False)
    monkeypatch.setattr(e2e_app, "system_clock", MovableClock(REAL_DAY))
    token, _ = _invitation_token(capsys)

    with TestClient(create_e2e_app()) as client:
        accepted = client.post(
            f"/invitations/{token}/accept",
            json={"business_name": "Real", "email": "r@example.com", "password": PASSWORD},
        )
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {accepted.json()['token']}"})

    assert me.json()["today"] == "2027-11-19"


def test_invite_business_prints_a_link_that_expires_seven_days_after_the_anchor(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv(CLOCK_OFFSET_VARIABLE, str(offset_seconds()))

    _, out = _invitation_token(capsys)

    assert re.fullmatch(
        r"http://localhost:9/invitation/\S+\nValid once, until 2026-10-14 15:00 UTC\.\n", out
    )


def test_reset_password_refuses_an_unknown_email_like_the_accounts_command(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv(CLOCK_OFFSET_VARIABLE, str(offset_seconds()))

    assert main(["reset-password", "nadie@example.com"]) == 1

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "no user for that email\n"


def test_offset_prints_only_the_integer(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["offset"]) == 0

    printed = capsys.readouterr().out
    assert re.fullmatch(r"-?\d+\n", printed)
    assert abs(int(printed) - offset_seconds()) <= 5


def _files_naming_the_variable(roots: tuple[str, ...], suffixes: tuple[str, ...]) -> set[str]:
    found: set[str] = set()
    for root in roots:
        for path in (REPO_ROOT / root).rglob("*"):
            if path.suffix in suffixes and "node_modules" not in path.parts:
                if CLOCK_OFFSET_VARIABLE in path.read_text(encoding="utf-8"):
                    found.add(path.relative_to(REPO_ROOT).as_posix())
    return found


def test_only_the_e2e_app_names_the_offset_variable() -> None:
    assert _files_naming_the_variable(("app", "web/src"), (".py", ".ts", ".tsx")) == set()
    own = {"tests/e2e_app.py", "tests/test_e2e_clock.py"}
    assert _files_naming_the_variable(("tests", "scripts"), (".py",)) - own == set()
    assert "tests/e2e_app.py" in _files_naming_the_variable(("tests",), (".py",))


def test_the_scan_rejects_a_file_that_names_the_variable(tmp_path: Path) -> None:
    stray = tmp_path / "stray.py"
    stray.write_text(f'import os\nos.environ["{CLOCK_OFFSET_VARIABLE}"]\n', encoding="utf-8")

    assert CLOCK_OFFSET_VARIABLE in stray.read_text(encoding="utf-8")
