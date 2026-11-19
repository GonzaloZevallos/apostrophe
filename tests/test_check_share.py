"""The scheduler's check share: how many workers a check may start.

`positive_count` and `auto_workers` are pure, so a table pins them; two subprocess runs show
the pytest command line honours the share and still starts without xdist.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Mapping

import pytest

from scripts.check_share import auto_workers, positive_count

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, None),
        ("", None),
        ("abc", None),
        ("0", None),
        ("-1", None),
        ("2.5", None),
        (" 2", None),
        ("2", 2),
        ("16", 16),
    ],
)
def test_positive_count_accepts_only_a_positive_whole_number(
    value: str | None, expected: int | None
) -> None:
    assert positive_count(value) == expected


@pytest.mark.parametrize(
    ("environ", "cpus", "expected"),
    [
        ({}, 4, 4),
        ({}, 16, 8),
        ({"CHECK_WORKERS": "2"}, 16, 2),
        ({"CHECK_WORKERS": "32"}, 16, 32),
        ({"PYTEST_XDIST_AUTO_NUM_WORKERS": "3"}, 16, 3),
        ({"PYTEST_XDIST_AUTO_NUM_WORKERS": "3", "CHECK_WORKERS": "2"}, 16, 3),
        ({"PYTEST_XDIST_AUTO_NUM_WORKERS": "abc", "CHECK_WORKERS": "2"}, 16, 2),
        ({"PYTEST_XDIST_AUTO_NUM_WORKERS": "0", "CHECK_WORKERS": "2"}, 16, 2),
        ({"PYTEST_XDIST_AUTO_NUM_WORKERS": "", "CHECK_WORKERS": ""}, 4, 4),
        ({"PYTEST_XDIST_AUTO_NUM_WORKERS": "-1", "CHECK_WORKERS": "0"}, 16, 8),
        ({"CHECK_WORKERS": "abc"}, 16, 8),
    ],
)
def test_auto_workers_prefers_the_xdist_variable_then_the_share_then_the_default(
    environ: Mapping[str, str], cpus: int, expected: int
) -> None:
    assert auto_workers(environ, cpus) == expected


def _pytest(*args: str, **env: str) -> subprocess.CompletedProcess[str]:
    base = {
        k: v
        for k, v in os.environ.items()
        if k not in {"PYTEST_XDIST_AUTO_NUM_WORKERS", "CHECK_WORKERS"}
    }
    return subprocess.run(
        [sys.executable, "-m", "pytest", *args],
        cwd=REPO_ROOT,
        env={**base, **env},
        capture_output=True,
        text=True,
        check=False,
    )


def test_pytest_auto_starts_the_workers_of_the_check_share() -> None:
    # `-o addopts=` drops pyproject's `-q`, which hides xdist's "created: N/N workers" line.
    # No `--co`: xdist starts no workers when it only collects. `-k positive_count` runs the
    # pure table above and never this test, so the run does not recurse.
    done = _pytest(
        "-n",
        "auto",
        "-p",
        "no:cacheprovider",
        "-o",
        "addopts=",
        "tests/test_check_share.py",
        "-k",
        "positive_count",
        CHECK_WORKERS="2",
    )
    assert done.returncode == 0, done.stdout + done.stderr
    assert "created: 2/2 workers" in done.stdout


def test_pytest_without_xdist_still_starts() -> None:
    done = _pytest("--co", "-p", "no:xdist", "-p", "no:cacheprovider", "tests/test_check_share.py")
    assert done.returncode == 0, done.stdout + done.stderr
