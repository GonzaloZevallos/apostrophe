"""Two branches that each add an ADR and its index row merge one after the other with no
conflict (GH-693, GH-692). `.gitattributes` makes `decisiones.md` merge with the `union`
driver; the throw-away repo below proves it with the real attribute line, and the generator
(`index_text`) says what the merged page must be. When the dates of two merged ADRs are
against their order the union page is out of order until it is regenerated. Git is run with the
user's and the system's config switched off and every setting explicit; a missing git binary
fails the test, it never skips it.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from scripts.docs.adr_index import index_text

REPO_ROOT = Path(__file__).resolve().parents[1]
INDEX = "docs/architecture/decisiones.md"
UNION_LINE = f"{INDEX} linguist-generated=true merge=union"

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


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *_GIT_SETTINGS, *args],
        cwd=repo,
        env=_GIT_ENV,
        check=True,
        capture_output=True,
        text=True,
    )


def _write_adr(repo: Path, stem: str) -> None:
    adr_dir = repo / "docs" / "adr"
    adr_dir.mkdir(parents=True, exist_ok=True)
    (adr_dir / f"{stem}.md").write_text(
        f'---\nstatus: accepted\ndate: 2026-10-02\nsummary: "{stem}"\n---\n', encoding="utf-8"
    )


def _write_page(repo: Path) -> None:
    page = repo / INDEX
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text(index_text(repo / "docs" / "adr"), encoding="utf-8")


def _repo_with_base(tmp_path: Path) -> Path:
    attribute_line = next(
        line
        for line in (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()
        if line.startswith(INDEX)
    )
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--initial-branch=main")
    (repo / ".gitattributes").write_text(attribute_line + "\n", encoding="utf-8")
    for stem in ("0001-a", "0002-b", "0003-c"):
        _write_adr(repo, stem)
    _write_page(repo)
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "base")
    return repo


def _branch_adding(repo: Path, branch: str, stem: str) -> None:
    _git(repo, "checkout", "-b", branch, "main")
    _write_adr(repo, stem)
    _write_page(repo)
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", f"adr {stem}")
    _git(repo, "checkout", "main")


def _merge_in_order(repo: Path, first: str, second: str) -> tuple[int, int]:
    one = _git(repo, "merge", "--no-edit", first)
    two = _git(repo, "merge", "--no-edit", second)
    return one.returncode, two.returncode


def test_the_index_is_merged_with_the_union_driver_in_the_real_gitattributes() -> None:
    lines = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()

    assert UNION_LINE in lines


def test_two_branches_adding_adrs_in_sorted_order_merge_to_the_generated_page(
    tmp_path: Path,
) -> None:
    repo = _repo_with_base(tmp_path)
    _branch_adding(repo, "a", "20261111-first-slug")
    _branch_adding(repo, "b", "20261111-second-slug")

    assert _merge_in_order(repo, "a", "b") == (0, 0)

    assert (repo / INDEX).read_text(encoding="utf-8") == index_text(repo / "docs" / "adr")


def test_two_branches_merged_against_their_date_order_leave_the_page_to_be_regenerated(
    tmp_path: Path,
) -> None:
    repo = _repo_with_base(tmp_path)
    _branch_adding(repo, "a", "20261112-x")
    _branch_adding(repo, "b", "20261111-y")

    assert _merge_in_order(repo, "a", "b") == (0, 0)

    merged = (repo / INDEX).read_text(encoding="utf-8")
    generated = index_text(repo / "docs" / "adr")
    assert merged != generated
    assert sorted(merged.splitlines()) == sorted(generated.splitlines())
    _write_page(repo)
    assert (repo / INDEX).read_text(encoding="utf-8") == generated
