"""Repo-wide docs tests (GH-461): the rules of `test_docs_rules.py` applied to the real files.

Text only; nothing imports from `app`. The tests that read citations out of the pages wait
for #460's merged link extractor and are added with it.
"""

from __future__ import annotations

from pathlib import Path

from tests.docs.test_docs_rules import adr_status

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_only_0030_among_the_real_adrs_is_superseded_by_0033() -> None:
    statuses = {
        path.name: adr_status(path.read_text(encoding="utf-8"))
        for path in sorted((REPO_ROOT / "docs" / "adr").glob("*.md"))
    }

    assert len(statuses) >= 20
    superseded = {n: s for n, s in statuses.items() if s and s.startswith("superseded")}
    assert [(n[:4], s) for n, s in superseded.items()] == [("0030", "superseded by 0033")]
