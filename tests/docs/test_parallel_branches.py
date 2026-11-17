"""Two branches that each change an endpoint and add an ADR merge into master with no conflict in
any owned path, because `.gitattributes` gives those paths the `regen` merge driver (GH-692).

The scratch repo below is built from the real `.gitattributes`, with one file per pattern of
`docs.paths` and ADRs with real front matter. The driver is configured by running the shipped
`setup.merge-driver` command of `.agentic/stack.yaml`, never a retyped copy of it. The driver
takes the side being merged in (`%B`): master's copy when master is merged into a branch, the
branch's copy when a branch is merged into master. The generator is never run by the driver;
`index_text` says what the page must be and the tests write it where a person would run
`generate`. Add/add merges cleanly through the driver; a file deleted on one side and edited on
the other still conflicts, because git does not call a driver for it. Without the driver the
same merges conflict. Git is run with the user's and the system's config switched off and every
setting explicit; a missing git binary fails the test, it never skips it.
"""

from __future__ import annotations

import os
import shlex
import subprocess
from pathlib import Path

import yaml

from scripts.docs.adr_index import index_text
from scripts.docs.owned_paths import owned_paths

REPO_ROOT = Path(__file__).resolve().parents[2]
INDEX = "docs/architecture/decisiones.md"
GENERATED_NEW = "docs/architecture/generated/added-on-both-sides.md"

_GIT_ENV = {
    **os.environ,
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_SYSTEM": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
}
_GIT_SETTINGS = [
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.autocrlf=false",
]


def _run(repo: Path, argv: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run `argv` (starting with `git`) in `repo` under the isolated git settings."""
    return subprocess.run(
        [argv[0], *_GIT_SETTINGS, *argv[1:]],
        cwd=repo,
        env=_GIT_ENV,
        check=check,
        capture_output=True,
        text=True,
    )


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return _run(repo, ["git", *args])


def _merge(repo: Path, branch: str) -> subprocess.CompletedProcess[str]:
    return _run(repo, ["git", "merge", "--no-edit", branch], check=False)


def _owned_file(pattern: str) -> str:
    """The one file the scratch repo keeps for an `owned_paths` pattern."""
    if pattern.endswith("/**"):
        return pattern.removesuffix("/**") + "/scratch.md"
    return pattern


def _owned_files() -> list[str]:
    return [_owned_file(pattern) for pattern in owned_paths(REPO_ROOT)]


def _write_adr(repo: Path, stem: str) -> None:
    adr_dir = repo / "docs" / "adr"
    adr_dir.mkdir(parents=True, exist_ok=True)
    (adr_dir / f"{stem}.md").write_text(
        f'---\nstatus: accepted\ndate: 2026-10-02\nsummary: "{stem}"\n---\n', encoding="utf-8"
    )


def _write_owned(repo: Path, tag: str) -> None:
    """What `generate` leaves: the page from the ADRs, and the endpoint line in the others."""
    for name in _owned_files():
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if name == INDEX:
            path.write_text(index_text(repo / "docs" / "adr"), encoding="utf-8")
        else:
            path.write_text(f"# {name}\nendpoints: {tag}\nend\n", encoding="utf-8")


def _repo_with_base(tmp_path: Path, *, driver: bool = True) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--initial-branch=main")
    (repo / ".gitattributes").write_text(
        (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8"), encoding="utf-8"
    )
    for stem in ("0001-a", "0002-b", "0003-c"):
        _write_adr(repo, stem)
    _write_owned(repo, "base")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "base")
    if driver:
        stack = yaml.safe_load((REPO_ROOT / ".agentic" / "stack.yaml").read_text(encoding="utf-8"))
        command = shlex.split(stack["setup"]["merge-driver"])
        assert command[:2] == ["git", "config"]
        _run(repo, command)
    return repo


def _branch_adding(repo: Path, branch: str, stem: str) -> None:
    """A branch off main that adds an ADR and changes the endpoint line of every owned file."""
    _git(repo, "checkout", "-b", branch, "main")
    _write_adr(repo, stem)
    _write_owned(repo, branch)
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", f"adr {stem}")
    _git(repo, "checkout", "main")


def _blob(repo: Path, ref: str, name: str) -> str:
    return _git(repo, "show", f"{ref}:{name}").stdout


def _unmerged(repo: Path) -> set[str]:
    listed = _git(repo, "ls-files", "--unmerged").stdout.splitlines()
    return {line.split("\t", 1)[1] for line in listed}


def _modified(repo: Path) -> set[str]:
    return {line[3:] for line in _git(repo, "status", "--porcelain").stdout.splitlines()}


def test_every_owned_file_of_the_scratch_repo_has_the_regen_driver(tmp_path: Path) -> None:
    repo = _repo_with_base(tmp_path)

    for name in _owned_files():
        attribute = _git(repo, "check-attr", "merge", "--", name).stdout.strip()
        assert attribute == f"{name}: merge: regen"


def test_the_scenario_is_in_the_fast_tier() -> None:
    stack = yaml.safe_load((REPO_ROOT / ".agentic" / "stack.yaml").read_text(encoding="utf-8"))

    assert "tests/docs/test_parallel_branches.py" in stack["checks"]["tests-fast"].split()


def test_two_branches_merge_into_master_one_after_the_other_with_the_incoming_copy(
    tmp_path: Path,
) -> None:
    repo = _repo_with_base(tmp_path)
    _branch_adding(repo, "a", "20261111-first-slug")
    _branch_adding(repo, "b", "20261111-second-slug")

    first = _merge(repo, "a")
    second = _merge(repo, "b")

    assert (first.returncode, second.returncode) == (0, 0), second.stdout
    assert _unmerged(repo) == set()
    for name in _owned_files():
        assert (repo / name).read_text(encoding="utf-8") == _blob(repo, "b", name)
    generated = index_text(repo / "docs" / "adr")
    assert "20261111-first-slug" in generated
    assert "20261111-second-slug" in generated


def test_the_page_after_the_merges_is_the_incoming_copy_until_it_is_regenerated(
    tmp_path: Path,
) -> None:
    repo = _repo_with_base(tmp_path)
    _branch_adding(repo, "a", "20261112-x")
    _branch_adding(repo, "b", "20261111-y")

    assert (_merge(repo, "a").returncode, _merge(repo, "b").returncode) == (0, 0)

    merged = (repo / INDEX).read_text(encoding="utf-8")
    generated = index_text(repo / "docs" / "adr")
    assert merged == _blob(repo, "b", INDEX)
    assert merged != generated
    assert "20261112-x" not in merged
    assert generated.index("20261111-y") < generated.index("20261112-x")
    (repo / INDEX).write_text(generated, encoding="utf-8")
    assert (repo / INDEX).read_text(encoding="utf-8") == generated


def test_master_merged_into_a_branch_brings_master_copy_and_leaves_the_page_to_regenerate(
    tmp_path: Path,
) -> None:
    repo = _repo_with_base(tmp_path)
    _branch_adding(repo, "a", "20261111-first-slug")
    _branch_adding(repo, "b", "20261111-second-slug")
    assert _merge(repo, "a").returncode == 0
    _git(repo, "checkout", "b")

    merged = _merge(repo, "main")

    assert merged.returncode == 0, merged.stdout
    assert _unmerged(repo) == set()
    for name in _owned_files():
        assert (repo / name).read_text(encoding="utf-8") == _blob(repo, "main", name)
    generated = index_text(repo / "docs" / "adr")
    assert (repo / INDEX).read_text(encoding="utf-8") != generated
    (repo / INDEX).write_text(generated, encoding="utf-8")
    assert _modified(repo) == {INDEX}


def test_a_file_added_on_both_sides_merges_through_the_driver(tmp_path: Path) -> None:
    repo = _repo_with_base(tmp_path)
    for branch in ("c", "d"):
        _git(repo, "checkout", "-b", branch, "main")
        (repo / GENERATED_NEW).write_text(f"from {branch}\n", encoding="utf-8")
        _git(repo, "add", ".")
        _git(repo, "commit", "-m", f"add {branch}")
        _git(repo, "checkout", "main")
    assert _merge(repo, "c").returncode == 0

    merged = _merge(repo, "d")

    version = _git(repo, "--version").stdout.strip()
    assert merged.returncode == 0, f"{version}: {merged.stdout}"
    assert _unmerged(repo) == set()
    assert (repo / GENERATED_NEW).read_text(encoding="utf-8") == "from d\n"


def test_a_generated_file_deleted_on_one_side_and_edited_on_the_other_still_conflicts(
    tmp_path: Path,
) -> None:
    repo = _repo_with_base(tmp_path)
    generated = _owned_file("docs/architecture/generated/**")
    _git(repo, "checkout", "-b", "a", "main")
    _git(repo, "rm", "-q", generated)
    _git(repo, "commit", "-m", "delete")
    _git(repo, "checkout", "-b", "b", "main")
    (repo / generated).write_text("edited\n", encoding="utf-8")
    _git(repo, "commit", "-a", "-m", "edit")
    _git(repo, "checkout", "main")
    assert _merge(repo, "a").returncode == 0

    merged = _merge(repo, "b")

    assert merged.returncode != 0
    assert _unmerged(repo) == {generated}


def test_without_the_driver_the_same_merges_conflict(tmp_path: Path) -> None:
    repo = _repo_with_base(tmp_path, driver=False)
    _branch_adding(repo, "a", "20261111-first-slug")
    _branch_adding(repo, "b", "20261111-second-slug")
    assert _merge(repo, "a").returncode == 0

    merged = _merge(repo, "b")

    assert merged.returncode != 0
    assert _unmerged(repo) == set(_owned_files())
