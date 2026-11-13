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


def _merge_values(attributes: str) -> dict[str, list[str]]:
    """Each path of `.gitattributes` mapped to every `merge=` value on its line."""
    found: dict[str, list[str]] = {}
    for line in attributes.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        path, *tokens = line.split()
        values = [token.removeprefix("merge=") for token in tokens if token.startswith("merge=")]
        if values:
            found.setdefault(path, []).extend(values)
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


def test_gitattributes_gives_every_docs_path_exactly_the_regen_driver() -> None:
    attributes = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8")
    merges = _merge_values(attributes)

    assert {path: merges.get(path) for path in owned_paths(REPO_ROOT)} == {
        path: ["regen"] for path in owned_paths(REPO_ROOT)
    }
    assert sorted(path for path, values in merges.items() if "regen" in values) == sorted(
        owned_paths(REPO_ROOT)
    )


def test_a_gitattributes_line_without_the_regen_driver_is_seen_as_a_difference() -> None:
    attributes = "docs/api/** linguist-generated=true merge=regen\n"

    merges = _merge_values(attributes)

    assert sorted(path for path, values in merges.items() if "regen" in values) != sorted(
        owned_paths(REPO_ROOT)
    )


def test_a_line_with_two_merge_tokens_is_not_exactly_regen() -> None:
    merges = _merge_values("docs/api/** merge=union merge=regen\n")

    assert merges == {"docs/api/**": ["union", "regen"]}
    assert merges["docs/api/**"] != ["regen"]


def test_a_line_with_only_the_union_driver_is_not_regen() -> None:
    merges = _merge_values("docs/architecture/decisiones.md linguist-generated=true merge=union\n")

    assert merges["docs/architecture/decisiones.md"] != ["regen"]
    assert "regen" not in merges["docs/architecture/decisiones.md"]


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


def _bot_owned_literal(script: str) -> list[str]:
    """The entries of the `BOT_OWNED=( ... )` literal of `bot-push.sh`, one quoted entry a line."""
    body = script.split("BOT_OWNED=(\n", 1)[1].split("\n)", 1)[0]
    return [line.strip().strip("'") for line in body.splitlines()]


def test_bot_push_owns_the_docs_paths_and_the_screens() -> None:
    script = (REPO_ROOT / "scripts" / "ci" / "bot-push.sh").read_text(encoding="utf-8")

    assert _bot_owned_literal(script) == [*owned_paths(REPO_ROOT), "docs/assets/screens/**"]


def test_a_bot_owned_literal_missing_a_path_is_seen_as_a_difference() -> None:
    script = "BOT_OWNED=(\n  'docs/api/**'\n  'docs/assets/screens/**'\n)\n"

    assert _bot_owned_literal(script) != [*owned_paths(REPO_ROOT), "docs/assets/screens/**"]
