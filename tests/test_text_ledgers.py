"""The front's text-ledgers (ADR-0048): `web/src/architecture/textLeft/<owner>.json` lists the
files that still write a visible literal of their own, one ledger per owner. A file sits in
exactly one ledger, so the owners that run in parallel never edit the same list; and a ledger
only shrinks, which `appText.real.test.ts` enforces against the real tree.

`ledger_overlaps` is a pure function over the ledgers, so a test can show it refuses an
overlap; the real-directory test applies it to the ledgers on disk.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LEDGER_DIR = REPO_ROOT / "web" / "src" / "architecture" / "textLeft"

OWNERS = (
    "getting-in-settings",
    "home-analysis-expenses-onboarding",
    "sales-customers",
    "shared",
    "varieties-stock-catalog",
)


def ledger_overlaps(ledgers: Mapping[str, Sequence[str]]) -> dict[str, list[str]]:
    """Each file held by two or more ledgers, mapped to those owners, sorted."""
    held: dict[str, list[str]] = {}
    for owner, files in ledgers.items():
        for file in files:
            held.setdefault(file, []).append(owner)
    return {file: sorted(owners) for file, owners in sorted(held.items()) if len(owners) > 1}


def _real_ledgers() -> dict[str, list[str]]:
    return {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(LEDGER_DIR.glob("*.json"))
    }


def test_the_ledgers_are_the_planned_owners() -> None:
    assert tuple(_real_ledgers()) == OWNERS


def test_the_real_ledgers_are_pairwise_disjoint() -> None:
    assert ledger_overlaps(_real_ledgers()) == {}


def test_every_ledger_entry_is_a_sorted_unique_path_to_a_file() -> None:
    for owner, files in _real_ledgers().items():
        assert files == sorted(set(files)), owner
        for file in files:
            assert (REPO_ROOT / "web" / file).is_file(), f"{owner}: {file} is gone, drop the entry"


def test_a_file_in_two_ledgers_is_refused() -> None:
    ledgers = {
        "shared": ["src/a.ts", "src/b.ts"],
        "sales-customers": ["src/b.ts", "src/c.ts"],
        "varieties-stock-catalog": ["src/b.ts"],
    }

    assert ledger_overlaps(ledgers) == {
        "src/b.ts": ["sales-customers", "shared", "varieties-stock-catalog"]
    }


def test_disjoint_ledgers_pass() -> None:
    assert ledger_overlaps({"shared": ["src/a.ts"], "sales-customers": ["src/b.ts"]}) == {}
