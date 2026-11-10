"""The columns #75 renamed stay out of the code that talks to the database by name
(CODING_STANDARDS §11, docs/adr/0077): the domain and the API keep `locked_until`,
`window_start`, `effective_from`, `sale_date` and `entry_date`; the adapters and the
removal use the stored names.

(a) under `app/*/adapters/**` (except `router.py` and `schemas.py`) and
`app/business_removal/**`, no string constant (a `text()` statement, an `order_by`, a
`getattr`, a column name, a dict key) is an old name or spells one as a whole word, and an
old name is a keyword only of a call to a callee in `DOMAIN_CALLS`, matched by exact name.
Docstrings are prose and are skipped. (b) every name in `DOMAIN_CALLS` resolves, through
the imports of the files that use it, to a definition under `app/*/domain` or
`app/*/application`: never a `*Row` or `*Table` class and never a local helper. (c) no
`<x>.get(LoginGuardRow | LoginAddressGuardRow, ...)` in `app/` or `tests/`: the guard
rows are keyed by `id` now, which nothing reads, so a `get` by email would find nothing.
Attribute access on rows is left to `mypy --strict`."""

from __future__ import annotations

import ast
import re
from collections.abc import Mapping, Set
from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT

OLD_NAMES = frozenset({"locked_until", "window_start", "effective_from", "sale_date", "entry_date"})
_OLD_WORD = re.compile(rf"(?<![A-Za-z0-9_])({'|'.join(sorted(OLD_NAMES))})(?![A-Za-z0-9_])")
# The API side of an adapter package, matched by file name.
API_SIDE_FILES = frozenset({"router.py", "schemas.py"})
# Callees whose keyword arguments are the domain's or the application's names, matched by
# exact name; each one is added by name when the build needs it.
DOMAIN_CALLS = frozenset({"PriceEntry", "Sale", "StockEntry", "record_sale"})
GUARD_ROWS = frozenset({"LoginGuardRow", "LoginAddressGuardRow"})
_ALLOWED_LAYERS = re.compile(r"^app\.[a-z_]+\.(domain|application)(\.|$)")


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


def _docstrings(tree: ast.AST) -> set[int]:
    """The ids of the constant nodes that are module, class or function docstrings."""
    found: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            first = node.body[0] if node.body else None
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant):
                found.add(id(first.value))
    return found


def old_names_used(source: str) -> list[str]:
    """Every string constant that is or spells an old name, and every old name used as a
    keyword argument, but not as a keyword of a call to a domain callee."""
    tree = ast.parse(source)
    prose = _docstrings(tree)
    found: list[str] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and id(node) not in prose
            and _OLD_WORD.search(node.value)
        ):
            found.append(f"string {node.value!r} line {node.lineno}")
        if isinstance(node, ast.Call) and not _call_names(node) & DOMAIN_CALLS:
            found += [
                f"keyword {keyword.arg!r} line {node.lineno}"
                for keyword in node.keywords
                if keyword.arg in OLD_NAMES
            ]
    return sorted(found)


def _defines(module: str, name: str) -> bool:
    path = REPO_ROOT / Path(*module.split(".")).with_suffix(".py")
    if not path.is_file():
        return False
    return any(
        isinstance(node, ast.ClassDef | ast.FunctionDef) and node.name == name
        for node in ast.walk(ast.parse(path.read_text()))
    )


def callee_problems(allowed: Set[str], sources: Mapping[str, str]) -> list[str]:
    """Every name in `allowed` that a file defines itself, that no file imports, or that a
    file imports from outside `app/*/domain` and `app/*/application` or from a module that
    does not define it."""
    imported: dict[str, set[str]] = {name: set() for name in allowed}
    local: set[tuple[str, str]] = set()
    for path, source in sources.items():
        for node in ast.walk(ast.parse(source)):
            if isinstance(node, ast.ImportFrom) and node.module is not None:
                for alias in node.names:
                    if alias.name in allowed:
                        imported[alias.name].add(node.module)
            if isinstance(node, ast.ClassDef | ast.FunctionDef) and node.name in allowed:
                local.add((path, node.name))
    problems = [f"{name} is defined in {path}" for path, name in sorted(local)]
    for name, modules in sorted(imported.items()):
        if not modules and not any(name == defined for _, defined in local):
            problems.append(f"{name} is imported by no scanned file")
        problems += [
            f"{name} is imported from {module}"
            for module in sorted(modules)
            if not _ALLOWED_LAYERS.match(module) or not _defines(module, name)
        ]
    return problems


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


def test_every_allowed_callee_is_a_domain_or_application_definition() -> None:
    sources = {str(path.relative_to(REPO_ROOT)): path.read_text() for path in _stored_name_files()}

    assert callee_problems(DOMAIN_CALLS, sources) == []


def test_no_guard_row_is_read_with_a_get() -> None:
    files = _python_files("app", "tests")
    assert files

    got = {
        str(path.relative_to(REPO_ROOT)): guard_rows_got_by_key(path.read_text()) for path in files
    }

    assert {path: lines for path, lines in got.items() if lines} == {}


def test_an_old_name_as_a_string_or_a_keyword_is_reported() -> None:
    source = (
        "row = {'locked_until': 1}\n"
        "fn(window_start=2)\n"
        "PriceEntry.of(effective_from=3)\n"
        "text('SELECT sale_date FROM sale')\n"
        "getattr(row, 'entry_date')\n"
        "Sale.record(sale_date=4)\n"
        "other(sale_date=5)\n"
        "ok = 'sale_dates'\n"
    )

    assert old_names_used(source) == [
        "keyword 'sale_date' line 7",
        "keyword 'window_start' line 2",
        "string 'SELECT sale_date FROM sale' line 4",
        "string 'entry_date' line 5",
        "string 'locked_until' line 1",
    ]


def test_a_docstring_may_spell_an_old_name() -> None:
    source = '"""The sale_date column."""\n\n\ndef f() -> None:\n    """entry_date"""\n'

    assert old_names_used(source) == []


def test_a_callee_that_is_a_row_class_or_a_local_helper_is_reported() -> None:
    sources = {
        "app/x/adapters/a.py": "from app.sales.adapters.tables import SaleRow\n",
        "app/x/adapters/b.py": "def make(sale_date):\n    return sale_date\n",
        "app/x/adapters/c.py": "from app.sales.domain.sale import Sale\n",
    }

    assert callee_problems({"SaleRow", "make", "Sale", "Ghost"}, sources) == [
        "make is defined in app/x/adapters/b.py",
        "Ghost is imported by no scanned file",
        "SaleRow is imported from app.sales.adapters.tables",
    ]


def test_a_get_of_a_guard_row_class_is_reported() -> None:
    source = (
        "a = session.get(LoginGuardRow, 'x')\n"
        "b = s.get(LoginAddressGuardRow, 'y')\n"
        "c = s.get(UserRow, 1)\n"
    )

    assert guard_rows_got_by_key(source) == [1, 2]
