"""Repo-wide docs tests (GH-461): the rules of `test_docs_rules.py` applied to the real files.

Text only; nothing imports from `app`. Links and Mermaid blocks are read with
`scripts/docs/links.py` through `page_problems`, never with a pattern of this file's own.
"""

from __future__ import annotations

import posixpath
import re
from pathlib import Path

from scripts.docs.links import extract_links
from tests.docs.test_docs_rules import adr_index_problems, adr_status, page_problems, reach_problems

REPO_ROOT = Path(__file__).resolve().parents[2]
_SUPERSEDED_MARK = re.compile(r"reemplazada por (\d{4})")


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


ADR_DIR = "docs/adr"
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


def _adr_statuses() -> dict[str, str | None]:
    return {
        path.name: adr_status(path.read_text(encoding="utf-8"))
        for path in sorted((REPO_ROOT / ADR_DIR).glob("*.md"))
    }


def _index_marks(page: str, markdown: str) -> dict[str, str | None]:
    """Each ADR file linked on a table row of `page`, mapped to the number named by
    `reemplazada por NNNN` on that row (None when it carries no mark). A link in the prose
    around the table does not put an ADR in the index."""
    marks: dict[str, str | None] = {}
    for line in markdown.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        found = _SUPERSEDED_MARK.search(line)
        for link in extract_links(line):
            path = posixpath.normpath(posixpath.join(posixpath.dirname(page), link.target))
            if posixpath.dirname(path) == ADR_DIR and path.endswith(".md"):
                name = posixpath.basename(path)
                marks[name] = found.group(1) if found else marks.get(name)
    return marks


def test_the_adr_index_lists_every_adr_with_the_mark_its_status_line_gives() -> None:
    page = "docs/architecture/decisiones.md"
    marks = _index_marks(page, (REPO_ROOT / page).read_text(encoding="utf-8"))

    assert adr_index_problems(marks, _adr_statuses()) == []
    assert {name for name, mark in marks.items() if mark} == {
        name
        for name, status in _adr_statuses().items()
        if status and status.startswith("superseded")
    }


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


def test_an_index_with_a_wrong_mark_and_a_missing_adr_is_rejected() -> None:
    page = "docs/architecture/decisiones.md"
    index = (
        "| [0001](../adr/0001-a.md) | uno | reemplazada por 0002 |\n"
        "| [0002](../adr/0002-b.md) | dos | |\n"
    )
    statuses: dict[str, str | None] = {
        "0001-a.md": "accepted",
        "0002-b.md": "accepted",
        "0003-c.md": "superseded by 0002",
    }

    assert adr_index_problems(_index_marks(page, index), statuses) == [
        "0003-c.md is in docs/adr/ but not in the index",
        "0001-a.md: index mark '0002' does not match status 'accepted'",
    ]


def test_an_adr_linked_only_in_the_prose_is_not_in_the_index() -> None:
    page = "docs/architecture/decisiones.md"
    index = (
        "Por ejemplo [0001](../adr/0001-a.md) puede estar enmendada.\n\n"
        "| [0002](../adr/0002-b.md) | dos | |\n"
    )
    statuses: dict[str, str | None] = {"0001-a.md": "accepted", "0002-b.md": "accepted"}

    assert adr_index_problems(_index_marks(page, index), statuses) == [
        "0001-a.md is in docs/adr/ but not in the index"
    ]
