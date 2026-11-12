"""Repo-wide docs tests (GH-461): the rules of `test_docs_rules.py` applied to the real files.

Text only; nothing imports from `app`. Links and Mermaid blocks are read with
`scripts/docs/links.py` through `page_problems`, never with a pattern of this file's own.
"""

from __future__ import annotations

import posixpath
from pathlib import Path

from scripts.docs.links import extract_links
from tests.docs.test_docs_rules import page_problems, reach_problems

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


REQUIRED_PAGES = [
    "docs/README.md",
    "docs/architecture/README.md",
    "docs/architecture/contexto.md",
    "docs/architecture/contenedores.md",
    "docs/architecture/componentes.md",
    "docs/architecture/modelo-de-datos.md",
    "docs/architecture/flujos-clave.md",
    "docs/architecture/decisiones.md",
]
API_REFERENCE = "docs/api/index.html"


def test_every_doc_page_is_within_two_clicks_of_the_docs_entry() -> None:
    pages = [
        path.relative_to(REPO_ROOT).as_posix()
        for pattern in ("architecture/*.md", "product/*.md", "adr/*.md")
        for path in sorted((REPO_ROOT / "docs").glob(pattern))
    ]
    links = {
        page: [
            link.target for link in extract_links((REPO_ROOT / page).read_text(encoding="utf-8"))
        ]
        for page in [*pages, "docs/README.md"]
    }

    assert reach_problems("docs/README.md", pages, links) == []
    assert "docs/api/index.html" in [
        posixpath.normpath(posixpath.join("docs", target.split("#", 1)[0]))
        for target in links["docs/README.md"]
    ]


def test_the_required_pages_and_the_api_reference_exist() -> None:
    missing = [
        page for page in [*REQUIRED_PAGES, API_REFERENCE] if not (REPO_ROOT / page).is_file()
    ]

    assert missing == []
