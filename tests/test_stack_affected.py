"""The affected forms and the delivery tier declared in `.agentic/stack.yaml` (ADR-0039,
agentic-system ADR-0064): structure only. The gate that reads them is another system's;
what this product owes is that every form can be substituted and exits non-zero on an
empty selection (never `--passWithNoTests`), that the fallback globs never swallow what
the e2e wrapper judges sound, and that `delivery_checks` names only declared checks,
leaves `web-e2e` out and still runs each sweep file the fast tier must not lose."""

from __future__ import annotations

import shlex
import tomllib
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any, cast

import pytest
import yaml

from scripts.affected import REPO_ROOT, WRAPPER_INPUTS, is_e2e_sound
from scripts.ci_changes import SELECTOR_INPUTS

STACK = cast(
    "dict[str, Any]",
    yaml.safe_load((REPO_ROOT / ".agentic" / "stack.yaml").read_text()),
)
CHECKS: dict[str, str] = STACK["checks"]
AFFECTED: dict[str, str] = STACK["affected_checks"]
FALLBACK: list[str] = STACK["affected_fallback"]
DELIVERY: list[str] = STACK["delivery_checks"]
E2E = REPO_ROOT / "web" / "e2e"

# Sweep files: each guards a whole-codebase rule, so the fast tier must keep running them.
SWEEP_FILES = [
    "tests/test_business_isolation.py",
    "tests/test_gated_routes.py",
    "tests/migrations/test_business_ownership.py",
    "tests/migrations/test_naming.py",
    "tests/architecture/test_architecture.py",
]
# The only pytest options that leave the selection of tests alone.
_FLAGS = {"-q", "-x"}


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


@pytest.mark.parametrize("path", SELECTOR_INPUTS)
def test_every_file_the_ci_selector_reads_is_a_fallback(path: str) -> None:
    assert (REPO_ROOT / path).is_file()
    assert _matched(path, FALLBACK)


def test_a_selector_input_outside_the_fallback_globs_is_refused() -> None:
    assert not _matched("scripts/ci_unlisted.py", FALLBACK)


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


def runs_path(command: str, path: str) -> bool:
    """Whether `command` is a pytest run that executes every test of `path`.

    Only options that never narrow the selection are allowed: `-n <N|auto>`,
    `-p no:cacheprovider`, `-q`, `-x` and `--maxfail=<N>`. Any other option, and any
    argument naming a single test (`::`), makes it false. A command naming no path runs
    the whole suite, which holds only because `pyproject.toml` sets
    `testpaths = ["tests"]` (pinned below). A path is run when a positional argument
    equals it or is a directory above it."""
    words = shlex.split(command)
    if words[:3] == ["uv", "run", "--no-project"]:
        words = words[3:]
    if not words or words[0] != "pytest":
        return False
    positionals: list[str] = []
    rest = iter(words[1:])
    for word in rest:
        if word == "-n":
            value = next(rest, "")
            if value != "auto" and not value.isdigit():
                return False
        elif word == "-p":
            if next(rest, "") != "no:cacheprovider":
                return False
        elif word in _FLAGS:
            continue
        elif word.startswith("--maxfail="):
            if not word.removeprefix("--maxfail=").isdigit():
                return False
        elif word.startswith("-") or "::" in word:
            return False
        else:
            positionals.append(word.rstrip("/"))
    if not positionals:
        return True
    return any(path == p or path.startswith(p + "/") for p in positionals)


@pytest.mark.parametrize(
    "command",
    [
        "pytest",
        "uv run --no-project pytest -n 8",
        "pytest -n auto",
        "pytest -p no:cacheprovider",
        "pytest -q",
        "pytest -x",
        "pytest --maxfail=3",
        "pytest -n 4 -p no:cacheprovider -q -x --maxfail=1",
        "pytest tests/architecture/test_architecture.py",
        "pytest tests/architecture",
        "pytest tests/architecture/",
        "pytest tests",
        "pytest tests/migrations tests/architecture/test_architecture.py",
    ],
)
def test_runs_path_accepts_a_command_that_runs_the_file(command: str) -> None:
    assert runs_path(command, "tests/architecture/test_architecture.py")


@pytest.mark.parametrize(
    "command",
    [
        "pytest tests/migrations",
        "pytest tests/architecture/test_no_spanish.py",
        "pytest tests/architecture_extra",
        "ruff check .",
        "npm --prefix web test",
        "",
        "pytest -k sweep",
        "pytest -m slow",
        "pytest --ignore=tests/architecture",
        "pytest --ignore-glob=tests/arch*",
        "pytest --deselect tests/architecture/test_architecture.py",
        "pytest --lf",
        "pytest --ff",
        "pytest --sw",
        "pytest --co",
        "pytest --durations=5",
        "pytest -n",
        "pytest -n many",
        "pytest -p other",
        "pytest --maxfail=x",
        "pytest tests/architecture/test_architecture.py::test_one",
        "pytest tests/architecture::x",
        "pytest -n 8 --ignore=tests/architecture/test_architecture.py",
    ],
)
def test_runs_path_rejects_a_command_that_may_skip_the_file(command: str) -> None:
    assert not runs_path(command, "tests/architecture/test_architecture.py")


def test_the_whole_suite_rule_rests_on_pyproject_testpaths() -> None:
    config = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())
    assert config["tool"]["pytest"]["ini_options"]["testpaths"] == ["tests"]


def test_delivery_checks_name_declared_checks_only() -> None:
    assert [name for name in DELIVERY if name not in CHECKS] == []


def test_delivery_checks_are_not_empty_and_have_no_duplicates() -> None:
    assert DELIVERY
    assert len(DELIVERY) == len(set(DELIVERY))


def test_delivery_checks_never_name_web_e2e() -> None:
    assert "web-e2e" not in DELIVERY
    assert "web-e2e" not in CHECKS
    assert "web-e2e" not in AFFECTED


def writes_pytest_cache(commands: dict[str, str]) -> list[str]:
    """The names of the pytest checks that write `.pytest_cache`.

    A check is pytest whatever its prefix (`pytest`, `uv run pytest`,
    `.venv/bin/pytest`, `py.test`, `python -m pytest`). It writes no cache only when
    `no:cacheprovider` is the value right after `-p`; the same text anywhere else does not
    count."""
    writers: list[str] = []
    for name, command in commands.items():
        words = shlex.split(command)
        pairs = list(zip(words, words[1:], strict=False))
        runs_pytest = any(w.rsplit("/", 1)[-1] in {"pytest", "py.test"} for w in words)
        if not runs_pytest and ("-m", "pytest") not in pairs:
            continue
        if ("-p", "no:cacheprovider") not in pairs:
            writers.append(name)
    return writers


@pytest.mark.parametrize(
    "command",
    [
        "pytest -n 8",
        "uv run pytest -n 8",
        "uv run --no-project pytest -n 8",
        "python -m pytest -n 8",
        ".venv/bin/pytest -n 8",
        "py.test -n 8",
        "pytest -n 8 no:cacheprovider",
        "pytest -n 8 --no:cacheprovider",
        "pytest -p other no:cacheprovider",
        "pytest -p",
        "pytest -n 8 -p cacheprovider",
    ],
)
def test_a_pytest_check_that_may_write_the_cache_is_found(command: str) -> None:
    assert writes_pytest_cache({"extra": command}) == ["extra"]


@pytest.mark.parametrize(
    "command",
    [
        "pytest -p no:cacheprovider",
        "uv run --no-project pytest -n 4 -p no:cacheprovider tests/architecture",
        "python -m pytest -p no:cacheprovider",
        "uv run --no-project ruff check .",
        "npm --prefix web test",
    ],
)
def test_a_check_that_writes_no_pytest_cache_is_not_counted(command: str) -> None:
    assert writes_pytest_cache({"extra": command}) == []


def test_each_pytest_cache_has_one_writer() -> None:
    assert writes_pytest_cache(CHECKS) == ["tests"]


@pytest.mark.parametrize("path", SWEEP_FILES)
def test_the_fast_tier_runs_every_sweep_file(path: str) -> None:
    assert (REPO_ROOT / path).is_file()
    assert any(runs_path(CHECKS[name], path) for name in DELIVERY)


def test_every_tests_path_a_check_names_exists() -> None:
    named = [
        word.rstrip("/")
        for command in CHECKS.values()
        for word in shlex.split(command)
        if word.startswith("tests/")
    ]
    assert named
    assert [p for p in named if not (REPO_ROOT / p).exists()] == []
