"""Two branches that each append an ADR row to the index merge one after the other with no
conflict (GH-693). `.gitattributes` makes `decisiones.md` merge with the `union` driver; the
throw-away repo below proves it with the real attribute line, and the two index checks prove
the merged page is still sound. Git is run with the user's and the system's config switched
off and every setting explicit; a missing git binary fails the test, it never skips it.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from tests.docs.test_docs_repo import _index_marks
from tests.docs.test_docs_rules import adr_index_problems, doubled_prose_lines

REPO_ROOT = Path(__file__).resolve().parents[1]
INDEX = "docs/architecture/decisiones.md"
UNION_LINE = f"{INDEX} merge=union"

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


def _row(stem: str) -> str:
    return f"| [{stem[:8]}](../adr/{stem}.md) | {stem} | |\n"


_INTRO = "# Decisiones\n\nIndice de los ADR. Las filas nuevas se agregan al final.\n\n"
_HEADER = "| ADR | Qué decide | Estado |\n| --- | --- | --- |\n"
_BASE_STEMS = ["0001-a", "0002-b", "0003-c"]


def test_the_index_is_merged_with_the_union_driver_in_the_real_gitattributes() -> None:
    lines = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()

    assert UNION_LINE in lines


def test_two_same_day_branches_that_append_an_index_row_merge_one_after_the_other(
    tmp_path: Path,
) -> None:
    attribute_line = next(
        line
        for line in (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()
        if line.startswith(INDEX)
    )
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--initial-branch=main")
    (repo / ".gitattributes").write_text(attribute_line + "\n", encoding="utf-8")
    index = repo / INDEX
    index.parent.mkdir(parents=True)
    index.write_text(_INTRO + _HEADER + "".join(_row(s) for s in _BASE_STEMS), encoding="utf-8")
    for stem in _BASE_STEMS:
        (repo / "docs" / "adr").mkdir(parents=True, exist_ok=True)
        (repo / "docs" / "adr" / f"{stem}.md").write_text("---\nstatus: accepted\n---\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "base")

    new = {"a": "20261111-first-slug", "b": "20261111-second-slug"}
    for branch, stem in new.items():
        _git(repo, "checkout", "-b", branch, "main")
        index.write_text(index.read_text(encoding="utf-8") + _row(stem), encoding="utf-8")
        (repo / "docs" / "adr" / f"{stem}.md").write_text("---\nstatus: accepted\n---\n")
        _git(repo, "add", ".")
        _git(repo, "commit", "-m", f"adr {stem}")
    _git(repo, "checkout", "main")

    first = _git(repo, "merge", "--no-edit", "a")
    second = _git(repo, "merge", "--no-edit", "b")

    assert (first.returncode, second.returncode) == (0, 0)
    merged = index.read_text(encoding="utf-8")
    for stem in new.values():
        assert merged.count(_row(stem)) == 1, stem
    rows = _index_marks(INDEX, merged)
    statuses: dict[str, str | None] = {
        path.name: "accepted" for path in sorted((repo / "docs" / "adr").glob("*.md"))
    }
    assert adr_index_problems(rows, statuses) == []
    assert doubled_prose_lines(merged) == []
