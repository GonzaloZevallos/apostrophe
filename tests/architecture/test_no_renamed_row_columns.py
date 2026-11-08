"""The columns #75 renamed stay out of the code that talks to the database by name
(CODING_STANDARDS §11, docs/adr/0077): the domain and the API keep `locked_until`,
`window_start` and `effective_from`; the adapters and the removal use the stored names.

(a) no string dict key and no keyword argument spells an old name under
`app/*/adapters/**` and `app/business_removal/**`, except on the API side
(`router.py`, `schemas.py`) and in a call to the domain `PriceEntry`. (b) no
`<x>.get(LoginGuardRow | LoginAddressGuardRow, ...)` in `app/` or `tests/`: the guard
rows are keyed by `id` now, which nothing reads, so a `get` by email would find nothing.
Attribute access on rows is left to `mypy --strict`."""

from __future__ import annotations

import ast
from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT

OLD_NAMES = frozenset({"locked_until", "window_start", "effective_from"})
# The API side of an adapter package, matched by file name.
API_SIDE_FILES = frozenset({"router.py", "schemas.py"})
# Calls whose keyword arguments are the domain's names.
DOMAIN_CALLS = frozenset({"PriceEntry"})
GUARD_ROWS = frozenset({"LoginGuardRow", "LoginAddressGuardRow"})


def _call_names(call: ast.Call) -> set[str]:
    """The names a call's function is spelled with: `PriceEntry` and `PriceEntry.of`
    both give `PriceEntry`."""
    names: set[str] = set()
    function: ast.expr = call.func
    while isinstance(function, ast.Attribute):
        function = function.value
    if isinstance(function, ast.Name):
        names.add(function.id)
    return names


def old_names_used(source: str) -> list[str]:
    """Every old name spelled as a dict key or a keyword argument, but not as a keyword
    of a call to a domain constructor."""
    found: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Dict):
            found += [
                f"key {key.value!r} line {key.lineno}"
                for key in node.keys
                if isinstance(key, ast.Constant) and key.value in OLD_NAMES
            ]
        if isinstance(node, ast.Call) and not _call_names(node) & DOMAIN_CALLS:
            found += [
                f"keyword {keyword.arg!r} line {node.lineno}"
                for keyword in node.keywords
                if keyword.arg in OLD_NAMES
            ]
    return sorted(found)


def guard_rows_got_by_key(source: str) -> list[int]:
    """The lines calling `<x>.get(<guard row class>, ...)`."""
    return sorted(
        node.lineno
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "get"
        and node.args
        and isinstance(node.args[0], ast.Name)
        and node.args[0].id in GUARD_ROWS
    )


def _stored_name_files() -> list[Path]:
    adapters = [
        path
        for path in (REPO_ROOT / "app").glob("*/adapters/**/*.py")
        if path.name not in API_SIDE_FILES
    ]
    return sorted([*adapters, *(REPO_ROOT / "app" / "business_removal").rglob("*.py")])


def _python_files(*roots: str) -> list[Path]:
    return sorted(path for root in roots for path in (REPO_ROOT / root).rglob("*.py"))


def test_the_adapters_and_the_removal_use_the_stored_column_names() -> None:
    files = _stored_name_files()
    assert files

    used = {str(path.relative_to(REPO_ROOT)): old_names_used(path.read_text()) for path in files}

    assert {path: found for path, found in used.items() if found} == {}


def test_no_guard_row_is_read_with_a_get() -> None:
    files = _python_files("app", "tests")
    assert files

    got = {
        str(path.relative_to(REPO_ROOT)): guard_rows_got_by_key(path.read_text()) for path in files
    }

    assert {path: lines for path, lines in got.items() if lines} == {}


def test_an_old_name_as_a_dict_key_or_a_keyword_is_reported() -> None:
    source = "row = {'locked_until': 1}\nfn(window_start=2)\nPriceEntry.of(effective_from=3)\n"

    assert old_names_used(source) == ["key 'locked_until' line 1", "keyword 'window_start' line 2"]


def test_a_get_of_a_guard_row_class_is_reported() -> None:
    source = (
        "a = session.get(LoginGuardRow, 'x')\n"
        "b = s.get(LoginAddressGuardRow, 'y')\n"
        "c = s.get(UserRow, 1)\n"
    )

    assert guard_rows_got_by_key(source) == [1, 2]
