"""The owned-path guard warns about generated output in a pull request and never fails (GH-708)."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts.docs.owned_guard import annotations, main

GENERATED = "docs/architecture/generated/reference/routes.md"
API = "docs/api/openapi.json"
INDEX = "docs/architecture/decisiones.md"


def _message(path: str) -> str:
    return (
        f"::warning file={path}::master regenerates this file after each merge; restore it "
        "from the merge-base with master instead of committing it in this pull request"
    )


@pytest.mark.parametrize("path", [GENERATED, API, INDEX])
def test_an_owned_path_gets_one_warning_naming_the_file(path: str) -> None:
    assert annotations([path]) == [_message(path)]


def test_a_path_that_only_looks_owned_gets_no_warning() -> None:
    assert annotations([INDEX + ".bak", "docs/architecture/README.md", "app/main.py"]) == []


def test_no_changed_path_gets_no_warning() -> None:
    assert annotations([]) == []


def test_only_the_owned_paths_of_a_mixed_change_are_named() -> None:
    assert annotations(["app/main.py", API, "README.md", INDEX]) == [_message(API), _message(INDEX)]


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
        cwd=repo,
        check=True,
        capture_output=True,
    )


def _commit(repo: Path, relative: str) -> None:
    target = repo / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f"{relative}\n", encoding="utf-8")
    _git(repo, "add", relative)
    _git(repo, "commit", "-m", f"add {relative}")


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    _git(tmp_path, "init", "-b", "base")
    _commit(tmp_path, "README.md")
    _git(tmp_path, "checkout", "-b", "feature")
    monkeypatch.chdir(tmp_path)
    return tmp_path


def test_a_branch_that_touches_an_owned_path_is_warned_and_passes(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _commit(repo, "app/feature.py")
    _commit(repo, API)
    assert main("base") == 0
    assert capsys.readouterr().out == _message(API) + "\n"


def test_a_branch_that_touches_no_owned_path_prints_nothing(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _commit(repo, "app/feature.py")
    assert main("base") == 0
    assert capsys.readouterr().out == ""


def test_head_equal_to_the_base_prints_nothing(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main("base") == 0
    assert capsys.readouterr().out == ""


def test_an_owned_path_changed_on_the_base_after_the_branch_point_is_not_the_branchs(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _commit(repo, "app/feature.py")
    _git(repo, "checkout", "base")
    _commit(repo, INDEX)
    _git(repo, "checkout", "feature")
    assert main("base") == 0
    assert capsys.readouterr().out == ""


def test_an_unknown_base_ref_prints_one_warning_naming_the_failed_step_and_passes(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main("no-such-ref") == 0
    assert capsys.readouterr().out == "::warning::owned-path guard: git merge-base failed\n"


def test_outside_a_git_repository_the_guard_warns_and_passes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("GIT_CEILING_DIRECTORIES", str(tmp_path.parent))
    assert main("base") == 0
    assert capsys.readouterr().out == "::warning::owned-path guard: git merge-base failed\n"
