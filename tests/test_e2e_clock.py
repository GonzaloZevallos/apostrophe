"""The e2e backend's anchored clock (GH-251, docs/adr/0043): the e2e run starts from a fixed
instant and keeps advancing, whatever the real date is."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
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


def files_naming_the_variable(
    base: Path, roots: tuple[str, ...], suffixes: tuple[str, ...]
) -> set[str]:
    """Files under `base/<root>` that name the variable, by its literal name or through the
    `CLOCK_OFFSET_VARIABLE` constant."""
    found: set[str] = set()
    for root in roots:
        for path in (base / root).rglob("*"):
            if path.suffix not in suffixes or "node_modules" in path.parts:
                continue
            text = path.read_text(encoding="utf-8")
            if CLOCK_OFFSET_VARIABLE in text or "CLOCK_OFFSET_VARIABLE" in text:
                found.add(path.relative_to(base).as_posix())
    return found


def test_only_the_e2e_app_names_the_offset_variable() -> None:
    assert files_naming_the_variable(REPO_ROOT, ("app", "web/src"), (".py", ".ts", ".tsx")) == set()
    own = {"tests/e2e_app.py", "tests/test_e2e_clock.py"}
    assert files_naming_the_variable(REPO_ROOT, ("tests", "scripts"), (".py",)) == own
    # The e2e harness: `fixtures.ts` writes it, `env.ts` passes it on, no spec names it.
    assert files_naming_the_variable(REPO_ROOT, ("web/e2e",), (".ts",)) == {
        "web/e2e/fixtures.ts",
        "web/e2e/env.ts",
    }


def test_the_scan_reports_files_that_name_the_variable_by_name_or_constant(
    tmp_path: Path,
) -> None:
    (tmp_path / "app").mkdir()
    (tmp_path / "web/src").mkdir(parents=True)
    (tmp_path / "app/literal.py").write_text(f'KEY = "{CLOCK_OFFSET_VARIABLE}"\n', encoding="utf-8")
    (tmp_path / "app/imported.py").write_text(
        "from tests.e2e_app import CLOCK_OFFSET_VARIABLE\n", encoding="utf-8"
    )
    (tmp_path / "web/src/stray.ts").write_text(
        f"process.env.{CLOCK_OFFSET_VARIABLE} = '1'\n", encoding="utf-8"
    )
    (tmp_path / "web/src/clean.ts").write_text("export const x = 1\n", encoding="utf-8")

    found = files_naming_the_variable(tmp_path, ("app", "web/src"), (".py", ".ts", ".tsx"))

    assert found == {"app/literal.py", "app/imported.py", "web/src/stray.ts"}


def test_the_scan_of_the_e2e_folder_reports_a_spec_that_names_the_variable(
    tmp_path: Path,
) -> None:
    (tmp_path / "web/e2e").mkdir(parents=True)
    (tmp_path / "web/e2e/stray.spec.ts").write_text(
        f"process.env.{CLOCK_OFFSET_VARIABLE} = '1'\n", encoding="utf-8"
    )
    (tmp_path / "web/e2e/clean.spec.ts").write_text("export const x = 1\n", encoding="utf-8")

    found = files_naming_the_variable(tmp_path, ("web/e2e",), (".ts",))

    assert found == {"web/e2e/stray.spec.ts"}


def _run_module(*args: str) -> subprocess.CompletedProcess[str]:
    """`python -m tests.e2e_app <args>` in a child process, with the current environment."""
    return subprocess.run(
        [sys.executable, "-m", "tests.e2e_app", *args],
        cwd=REPO_ROOT,
        env=dict(os.environ),
        capture_output=True,
        text=True,
        check=False,
    )


def _assert_link_valid_until(stdout: str, link: str, expiry: datetime, started: float) -> None:
    """The child's anchored clock keeps advancing from the offset the test read at `started`
    (`time.monotonic()`), so its printed expiry is `expiry` plus at most the time the test has
    run since, however slow a busy machine made the children."""
    printed = re.fullmatch(rf"{link}\nValid once, until (\S+ \S+) UTC\.\n", stdout)
    assert printed, stdout
    until = datetime.strptime(printed[1], "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
    elapsed = timedelta(seconds=time.monotonic() - started + 1)
    assert expiry <= until <= expiry + elapsed


def test_module_execution_prints_only_the_offset_integer(e2e_environment: None) -> None:
    # The child reads the clock somewhere between these two reads, however long an
    # interpreter takes to start on a busy machine, and the offset only falls as time goes.
    before = offset_seconds()
    run = _run_module("offset")
    after = offset_seconds()

    assert run.returncode == 0, run.stderr
    assert re.fullmatch(r"-?\d+\n", run.stdout)
    assert after <= int(run.stdout) <= before
    assert run.stderr == ""


def test_module_execution_invites_a_business_on_the_anchored_clock(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = time.monotonic()
    monkeypatch.setenv(CLOCK_OFFSET_VARIABLE, str(offset_seconds()))

    run = _run_module("invite-business")

    assert run.returncode == 0, run.stderr
    _assert_link_valid_until(
        run.stdout,
        r"http://localhost:9/invitation/\S+",
        datetime(2026, 10, 14, 15, 0, tzinfo=UTC),
        started,
    )


def test_module_execution_issues_a_reset_link_a_day_after_the_anchor(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = time.monotonic()
    monkeypatch.setenv(CLOCK_OFFSET_VARIABLE, str(offset_seconds()))
    token = _run_module("invite-business").stdout.splitlines()[0].rsplit("/", 1)[1]
    with TestClient(create_e2e_app()) as client:
        accepted = client.post(
            f"/invitations/{token}/accept",
            json={"business_name": "Reset", "email": "reset@example.com", "password": PASSWORD},
        )
        assert accepted.status_code == 201, accepted.text

    run = _run_module("reset-password", "reset@example.com")

    assert run.returncode == 0, run.stderr
    _assert_link_valid_until(
        run.stdout,
        r"http://localhost:9/reset/\S+",
        datetime(2026, 10, 8, 15, 0, tzinfo=UTC),
        started,
    )


def test_an_empty_offset_variable_means_the_real_clock(
    e2e_environment: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(CLOCK_OFFSET_VARIABLE, "")
    monkeypatch.setattr(e2e_app, "system_clock", MovableClock(REAL_DAY))

    assert e2e_app.environment_clock()() == REAL_DAY
