"""The restore path end to end against a local bare repository standing in for
`GonzaloZevallos/apostrophe-backups`: `git ls-remote --heads` -> `newest_backup.main` ->
`git clone --branch <name>`, and `expired --now` -> `git push --atomic --delete`.

Local git only, no network: the "remote" is a bare repository in `tmp_path` reached
through a `file://` URL, and git runs with its configuration isolated from the machine's.
Git is a requirement of this file (it needs `git init --initial-branch`, so git >= 2.28):
when it is missing, the tests fail if `CI` is set and skip otherwise; when it is older
than 2.28 they fail either way.
"""

from __future__ import annotations

import contextlib
import io
import os
import re
import shutil
import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest

from scripts.newest_backup import main

MIN_GIT = (2, 28)
NOW = "20261101T000000Z"

# Older than 30 days before NOW, and not the newest: the cleanup deletes these.
OLD_AUG = "backup-20260801T040000Z-101.db.age"
OLD_SEP = "backup-20260901T040000Z-102.db.age"
# Exactly 30 days before NOW (kept), and inside 30 days.
EDGE = "backup-20261002T000000Z-103.db.age"
INSIDE = "backup-20261025T040000Z-104.db.age"
NEWEST = "backup-20261031T040000Z-105.db.age"
# An impossible date: ignored by the script, so never listed and never deleted.
MALFORMED = "backup-20261301T000000Z-1.db.age"

COMMIT_FLAGS = ("-c", "user.name=Backup Test", "-c", "user.email=backup@example.invalid")
GIT_DATE = "2026-11-01T00:00:00+00:00"


@pytest.fixture(autouse=True)
def _git_is_available() -> Iterator[None]:
    if shutil.which("git") is None:
        if os.environ.get("CI"):
            pytest.fail("git is required for the restore-path tests and was not found")
        pytest.skip("git is not installed")
    version = subprocess.run(["git", "--version"], check=True, capture_output=True, text=True)
    found = re.search(r"(\d+)\.(\d+)", version.stdout)
    if found is None or (int(found.group(1)), int(found.group(2))) < MIN_GIT:
        pytest.fail("git >= 2.28 required (for init --initial-branch)")
    yield


def _git(*args: str, cwd: Path, input: str | None = None) -> str:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_AUTHOR_DATE": GIT_DATE,
        "GIT_COMMITTER_DATE": GIT_DATE,
    }
    done = subprocess.run(
        ["git", *args], cwd=cwd, input=input, check=True, capture_output=True, text=True, env=env
    )
    return done.stdout


def _commit_orphan(bare: Path, branch: str, filename: str) -> None:
    """One parentless commit on `refs/heads/<branch>` holding one file `filename`."""
    blob = _git("hash-object", "-w", "--stdin", cwd=bare, input=f"stub of {filename}\n").strip()
    tree = _git("mktree", cwd=bare, input=f"100644 blob {blob}\t{filename}\n").strip()
    commit = _git(
        *COMMIT_FLAGS,
        "-c",
        "commit.gpgsign=false",
        "commit-tree",
        tree,
        "-m",
        f"copy {branch}",
        cwd=bare,
    ).strip()
    _git("update-ref", f"refs/heads/{branch}", commit, cwd=bare)


@pytest.fixture
def remote(tmp_path: Path) -> str:
    bare = tmp_path / "remote.git"
    bare.mkdir()
    _git("init", "--bare", "--initial-branch=main", cwd=bare)
    _commit_orphan(bare, "main", "README.md")
    for name in (OLD_AUG, OLD_SEP, EDGE, INSIDE, NEWEST, MALFORMED):
        _commit_orphan(bare, name, name)
    return bare.as_uri()


def _heads(url: str, cwd: Path) -> str:
    return _git("ls-remote", "--heads", url, cwd=cwd)


def _head_names(url: str, cwd: Path) -> set[str]:
    return {line.split("\trefs/heads/")[1] for line in _heads(url, cwd).splitlines()}


def _run_main(argv: list[str], listing: str) -> tuple[int, str]:
    stdout = io.StringIO()
    with contextlib.redirect_stdout(stdout):
        code = main(argv, io.StringIO(listing))
    return code, stdout.getvalue()


def test_the_newest_copy_clones_from_the_remote(remote: str, tmp_path: Path) -> None:
    listing = _heads(remote, tmp_path)

    code, out = _run_main([], listing)

    assert code == 0
    name = out.splitlines()[0].removeprefix("name: ")
    assert name == NEWEST
    target = tmp_path / "restore"
    _git(
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        name,
        remote,
        str(target),
        cwd=tmp_path,
    )
    assert (target / name).is_file()


def test_the_cleanup_deletes_only_expired_copies(remote: str, tmp_path: Path) -> None:
    code, out = _run_main(["expired", "--now", NOW], _heads(remote, tmp_path))

    assert code == 0
    names = out.split()
    assert names == [OLD_AUG, OLD_SEP]
    _git("push", "--atomic", remote, "--delete", *names, cwd=tmp_path / "remote.git")
    assert _head_names(remote, tmp_path) == {"main", EDGE, INSIDE, NEWEST, MALFORMED}


def test_a_listing_that_git_did_not_print_is_rejected_before_any_delete() -> None:
    # The enforcement side: an empty listing (e.g. a failed ls-remote) must not read as
    # "nothing to delete" -- it exits 1, and a mangled one exits 2, both with no names.
    assert _run_main(["expired", "--now", NOW], "") == (1, "")
    assert _run_main(["expired", "--now", NOW], "fatal: repository not found\n") == (2, "")
