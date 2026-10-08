"""The e2e app's parent-pid watcher (GH-152): each Playwright worker starts its own
uvicorn and passes its pid, so a crashed worker never leaves a server alive. The pieces
are pure functions with their effects injected; the app factory only starts the thread
when the variable is set."""

from __future__ import annotations

import threading
from pathlib import Path

import pytest

from tests import e2e_app
from tests.e2e_app import create_e2e_app, parent_gone, watch_parent


def test_parent_gone_is_false_when_the_signal_is_delivered() -> None:
    calls: list[tuple[int, int]] = []

    def kill(pid: int, sig: int) -> None:
        calls.append((pid, sig))

    assert parent_gone(4321, kill) is False
    assert calls == [(4321, 0)]


def test_parent_gone_is_true_when_no_such_process() -> None:
    def kill(pid: int, sig: int) -> None:
        raise ProcessLookupError

    assert parent_gone(4321, kill) is True


def test_parent_gone_is_false_when_the_process_is_not_ours_to_signal() -> None:
    def kill(pid: int, sig: int) -> None:
        raise PermissionError

    assert parent_gone(4321, kill) is False


def test_parent_gone_reraises_any_other_os_error() -> None:
    def kill(pid: int, sig: int) -> None:
        raise OSError("boom")

    with pytest.raises(OSError, match="boom"):
        parent_gone(4321, kill)


def test_watch_parent_sleeps_the_interval_while_alive_then_exits_once() -> None:
    answers = iter([False, False, True])
    asked: list[int] = []
    slept: list[float] = []
    exited: list[int] = []

    def gone(pid: int) -> bool:
        asked.append(pid)
        return next(answers)

    watch_parent(
        77,
        gone=gone,
        exit=exited.append,
        interval=0.5,
        sleep=slept.append,
    )

    assert asked == [77, 77, 77]
    assert slept == [0.5, 0.5]
    assert exited == [0]


@pytest.fixture
def started_watchers(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> list[threading.Thread]:
    """Records every watcher thread the factory starts, and never runs its loop inside the
    test run. The environment is the one `create_e2e_app` needs, minus the parent pid."""
    started: list[threading.Thread] = []
    real_start = threading.Thread.start

    def recording_start(self: threading.Thread) -> None:
        if self.name == e2e_app.WATCHER_THREAD_NAME:
            started.append(self)
            return
        real_start(self)

    monkeypatch.setattr(threading.Thread, "start", recording_start)
    monkeypatch.delenv("APOSTROPHE_E2E_PARENT_PID", raising=False)
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k" * 32)
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path}/w.db")
    return started


def test_create_e2e_app_starts_no_watcher_without_the_variable(
    started_watchers: list[threading.Thread],
) -> None:
    create_e2e_app()

    assert started_watchers == []


def test_create_e2e_app_starts_one_daemon_watcher_when_the_variable_is_set(
    started_watchers: list[threading.Thread], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APOSTROPHE_E2E_PARENT_PID", "4321")

    create_e2e_app()

    assert len(started_watchers) == 1
    assert started_watchers[0].daemon is True
