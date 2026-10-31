"""Repo-wide docs tests (GH-461): the rules of `test_docs_rules.py` applied to the real files.

Text only; nothing imports from `app`. Links and Mermaid blocks are read with
`scripts/docs/links.py` through `page_problems`, never with a pattern of this file's own.
"""

from __future__ import annotations

from pathlib import Path

from tests.docs.test_docs_rules import page_problems

REPO_ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str | None:
    """File text; "" for a directory (it exists but holds no symbol); None when missing."""
    target = REPO_ROOT / path
    if target.is_dir():
        return ""
    return target.read_text(encoding="utf-8") if target.is_file() else None


def _pages() -> list[Path]:
    pages = sorted((REPO_ROOT / "docs" / "architecture").glob("*.md"))
    entry = REPO_ROOT / "docs" / "README.md"
    return [*pages, entry] if entry.is_file() else pages


def test_every_architecture_page_and_the_docs_entry_obey_the_citation_rules() -> None:
    problems = [
        problem
        for page in _pages()
        for problem in page_problems(
            page.relative_to(REPO_ROOT).as_posix(), page.read_text(encoding="utf-8"), _read
        )
    ]

    assert problems == []
