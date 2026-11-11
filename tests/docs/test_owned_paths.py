"""The paths the docs generator owns are listed once, in `docs.paths` of `stack.yaml` (GH-692).

`writer.OWNED_ROOTS` and the `linguist-generated` lines of `.gitattributes` must cover the same
set. Reads of the repo are literal `REPO_ROOT / ...` chains.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from scripts.docs.owned_paths import owned_paths
from scripts.docs.writer import OWNED_ROOTS

REPO_ROOT = Path(__file__).resolve().parents[2]


def _linguist_generated(attributes: str) -> list[str]:
    """The paths of the `.gitattributes` lines that carry the token `linguist-generated=true`."""
    found: list[str] = []
    for line in attributes.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        path, *tokens = line.split()
        if "linguist-generated=true" in tokens:
            found.append(path)
    return found


def test_docs_paths_lists_the_page_next_to_the_two_directories() -> None:
    assert owned_paths(REPO_ROOT) == [
        "docs/architecture/generated/**",
        "docs/api/**",
        "docs/architecture/decisiones.md",
    ]


def test_the_writer_owns_exactly_docs_paths() -> None:
    assert sorted(OWNED_ROOTS) == sorted(owned_paths(REPO_ROOT))


def test_gitattributes_marks_exactly_docs_paths_as_generated() -> None:
    attributes = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8")

    assert sorted(_linguist_generated(attributes)) == sorted(owned_paths(REPO_ROOT))


def test_a_gitattributes_line_missing_a_path_is_seen_as_a_difference() -> None:
    attributes = "*.mo binary\ndocs/api/** linguist-generated=true\n"

    assert sorted(_linguist_generated(attributes)) != sorted(owned_paths(REPO_ROOT))


def test_the_command_prints_one_path_per_line() -> None:
    done = subprocess.run(
        [sys.executable, "-m", "scripts.docs.owned_paths"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    assert done.stdout.splitlines() == owned_paths(REPO_ROOT)


def test_a_docs_paths_that_is_not_a_list_of_strings_is_rejected(tmp_path: Path) -> None:
    (tmp_path / ".agentic").mkdir()
    (tmp_path / ".agentic" / "stack.yaml").write_text("docs:\n  paths: docs/api/**\n")

    with pytest.raises(ValueError, match="docs.paths is not a list of strings"):
        owned_paths(tmp_path)
