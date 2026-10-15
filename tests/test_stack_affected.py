"""The affected forms declared in `.agentic/stack.yaml` (ADR-0039): structure only. The
gate that reads them is another system's; what this product owes is that every form can
be substituted and exits non-zero on an empty selection (never `--passWithNoTests`), and
that the fallback globs never swallow what the e2e wrapper judges sound."""

from __future__ import annotations

from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any, cast

import pytest
import yaml

from scripts.affected import REPO_ROOT, WRAPPER_INPUTS, is_e2e_sound

STACK = cast(
    "dict[str, Any]",
    yaml.safe_load((REPO_ROOT / ".agentic" / "stack.yaml").read_text()),
)
CHECKS: dict[str, str] = STACK["checks"]
AFFECTED: dict[str, str] = STACK["affected_checks"]
FALLBACK: list[str] = STACK["affected_fallback"]
E2E = REPO_ROOT / "web" / "e2e"


def _matched(path: str, globs: list[str]) -> bool:
    return any(fnmatchcase(path, glob) for glob in globs)


def _repo_paths(directory: Path, pattern: str) -> list[str]:
    return sorted(p.relative_to(REPO_ROOT).as_posix() for p in directory.glob(pattern))


@pytest.mark.parametrize("name", sorted(AFFECTED))
def test_an_affected_form_belongs_to_a_declared_check(name: str) -> None:
    assert name in CHECKS


def command_problems(command: str, full: str) -> list[str]:
    """What is wrong with an affected command: it must take the base sha, never start
    with it, differ from the full form and never let an empty selection pass."""
    problems: list[str] = []
    if "{base}" not in command:
        problems.append("no {base}")
    if command.startswith("{base}"):
        problems.append("starts with {base}")
    if "--passWithNoTests" in command or "--pass-with-no-tests" in command:
        problems.append("accepts an empty selection")
    if command == full:
        problems.append("same as the full form")
    return problems


@pytest.mark.parametrize("name", sorted(AFFECTED))
def test_an_affected_command_can_be_substituted_and_never_accepts_an_empty_selection(
    name: str,
) -> None:
    assert command_problems(AFFECTED[name], CHECKS[name]) == []


@pytest.mark.parametrize(
    ("command", "problem"),
    [
        ("vitest run --changed {base} --passWithNoTests", "accepts an empty selection"),
        ("vitest run --pass-with-no-tests --changed {base}", "accepts an empty selection"),
        ("{base} vitest run", "starts with {base}"),
        ("vitest run", "no {base}"),
        ("vitest run {base}", "same as the full form"),
    ],
)
def test_a_bad_affected_command_is_rejected(command: str, problem: str) -> None:
    assert problem in command_problems(command, "vitest run {base}")


def test_every_fallback_entry_is_a_non_blank_string() -> None:
    assert FALLBACK
    for entry in FALLBACK:
        assert isinstance(entry, str)
        assert entry.strip()


@pytest.mark.parametrize("path", WRAPPER_INPUTS)
def test_every_file_the_wrapper_depends_on_is_a_fallback(path: str) -> None:
    assert (REPO_ROOT / path).is_file()
    assert _matched(path, FALLBACK)


def test_no_e2e_sound_path_is_a_fallback() -> None:
    samples = [
        "web/e2e/flow.spec.ts",
        "web/e2e/helpers/seed.ts",
        *_repo_paths(E2E, "**/*.spec.ts"),
        *_repo_paths(E2E / "helpers", "**/*"),
    ]
    assert len(samples) > 4
    for path in samples:
        assert is_e2e_sound(path), path
        assert not _matched(path, FALLBACK), path


def test_every_file_directly_under_e2e_that_is_not_a_spec_or_helper_is_unsound() -> None:
    others = [
        p.relative_to(REPO_ROOT).as_posix()
        for p in E2E.iterdir()
        if p.is_file() and not p.name.endswith(".spec.ts")
    ]
    assert "web/e2e/env.ts" in others
    for path in others:
        assert not is_e2e_sound(path), path
