"""No file under `tests/` or `app/` reads the real clock (ADR-0001: the clock is injected,
ADR-0043), except the few named in `REAL_CLOCK_SYMBOLS` and `CLOCK_NAMING_PATHS`, each with
its reason. A test that reasons about an instant takes it from the `MovableClock` the app
under test was built with.

The checker parses each file and resolves every name through the module's import table
(`import` and `from ... import`, aliases included, wherever the import sits): a name
counts for what it is bound to, not for how it is spelled. It flags references as well as
calls (`default_factory=datetime.now`) to `datetime.datetime.now`, `utcnow` and `today`,
`datetime.date.today`, `time.time`, `time.time_ns` and `app.clock.system_clock`, which it
flags as a bare name, an import or an attribute. `time.monotonic` and `time.sleep` measure
no date and pass, and so does any attribute that merely shares a name (`answer.today`).

One concession, for a source with no import to resolve: a bare `datetime`, `date` or
`system_clock` that nothing in the module binds (no import, assignment, definition or
parameter) is read as the standard library's or the app's own.

Two limits, by design:

- Patching by string (`monkeypatch.setattr(mod, "system_clock", clock)`) is outside the
  scan: its target must be a `MovableClock`.
- A real-clock alias imported from another test module is caught where it is defined, not
  where it is used.
"""

from __future__ import annotations

import ast
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCANNED = ("tests", "app")

SYSTEM_CLOCK = "app.clock.system_clock"
WALL_CLOCK_READS = frozenset(
    {
        "datetime.datetime.now",
        "datetime.datetime.utcnow",
        "datetime.datetime.today",
        "datetime.date.today",
        "time.time",
        "time.time_ns",
    }
)
TARGETS = WALL_CLOCK_READS | {SYSTEM_CLOCK}
# What a name no import and no statement binds stands for (a source with no imports).
UNBOUND_NAMES = {
    "datetime": "datetime.datetime",
    "date": "datetime.date",
    "system_clock": SYSTEM_CLOCK,
}

# Closed. A read of the wall clock that stays, keyed by path and the function that holds it.
REAL_CLOCK_SYMBOLS: dict[str, str] = {
    "app/clock.py::system_clock": "the production clock: the one function that asks the machine",
}
# Closed, one path each, no glob. Where `system_clock` may be named, to hand it to the app.
CLOCK_NAMING_PATHS: dict[str, str] = {
    "app/main.py": "composition root: create_app's default clock",
    "app/accounts/adapters/cli.py": "composition root of the accounts command line",
    "app/business_removal/adapters/cli.py": "composition root of the removal command line",
    "app/spreadsheet_import/adapters/cli.py": "composition root of the import command line",
    "tests/e2e_app.py": (
        "the e2e backend shares the real clock with the CLI subprocess and the browser "
        "by design (ADR-0040)"
    ),
}


@dataclass(frozen=True)
class Read:
    path: str
    line: int
    symbol: str
    target: str

    def where(self) -> str:
        return f"{self.path}:{self.line}"


def real_clock_reads(source: str, path: str = "") -> list[Read]:
    """Every read of the real clock in `source`, with the function that holds it."""
    tree = ast.parse(source)
    table = _import_table(tree)
    bound = _bound_names(tree)
    reads: set[Read] = set()

    def resolve(node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            if node.id in table:
                return table[node.id]
            return None if node.id in bound else UNBOUND_NAMES.get(node.id)
        if isinstance(node, ast.Attribute):
            owner = resolve(node.value)
            return None if owner is None else f"{owner}.{node.attr}"
        return None

    def visit(node: ast.AST, symbol: str) -> None:
        if isinstance(node, ast.ImportFrom) and node.module and not node.level:
            for alias in node.names:
                if f"{node.module}.{alias.name}" in TARGETS:
                    reads.add(Read(path, node.lineno, symbol, f"{node.module}.{alias.name}"))
        elif isinstance(node, ast.Name | ast.Attribute) and isinstance(node.ctx, ast.Load):
            target = resolve(node)
            if target in TARGETS:
                reads.add(Read(path, node.lineno, symbol, target))
        inner = node.name if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) else symbol
        for child in ast.iter_child_nodes(node):
            visit(child, inner)

    visit(tree, "")
    return sorted(reads, key=lambda read: (read.line, read.target))


def real_clock_lines(source: str) -> list[int]:
    """The line of every read of the real clock in `source`, in order."""
    return sorted({read.line for read in real_clock_reads(source)})


def _import_table(tree: ast.AST) -> dict[str, str]:
    """local name -> the dotted thing it stands for ("dt" -> "datetime")."""
    table: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.asname:
                    table[alias.asname] = alias.name
                else:
                    top = alias.name.split(".")[0]
                    table[top] = top
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            for alias in node.names:
                table[alias.asname or alias.name] = f"{node.module}.{alias.name}"
    return table


def _bound_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store | ast.Del):
            names.add(node.id)
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            names.add(node.name)
        elif isinstance(node, ast.arg):
            names.add(node.arg)
    return names


def tree_reads(directory: Path, base: Path) -> list[Read]:
    """Every read in every `.py` file under `directory`, paths relative to `base`."""
    return [
        read
        for file in sorted(directory.rglob("*.py"))
        for read in real_clock_reads(file.read_text(), file.relative_to(base).as_posix())
    ]


def is_allowed(read: Read) -> bool:
    if f"{read.path}::{read.symbol}" in REAL_CLOCK_SYMBOLS:
        return True
    return read.target == SYSTEM_CLOCK and read.path in CLOCK_NAMING_PATHS


def tree_hits(directory: Path, base: Path) -> list[str]:
    """`path:line` of every read under `directory` that the allowlists do not cover."""
    return [read.where() for read in tree_reads(directory, base) if not is_allowed(read)]


def stale_entries(reads: Iterable[Read]) -> list[str]:
    """Allowlist entries that no read matches any more."""
    seen = list(reads)
    symbols = {f"{read.path}::{read.symbol}" for read in seen if read.target in WALL_CLOCK_READS}
    paths = {read.path for read in seen if read.target == SYSTEM_CLOCK}
    return [entry for entry in REAL_CLOCK_SYMBOLS if entry not in symbols] + [
        entry for entry in CLOCK_NAMING_PATHS if entry not in paths
    ]


def test_no_file_under_tests_or_app_reads_the_real_clock() -> None:
    hits = [hit for tree in SCANNED for hit in tree_hits(REPO_ROOT / tree, REPO_ROOT)]

    assert hits == []


def test_every_allowlist_entry_still_matches_a_read() -> None:
    reads = [read for tree in SCANNED for read in tree_reads(REPO_ROOT / tree, REPO_ROOT)]

    assert stale_entries(reads) == []


def test_every_allowlist_entry_has_a_reason() -> None:
    assert all([*REAL_CLOCK_SYMBOLS.values(), *CLOCK_NAMING_PATHS.values()])


def test_a_stale_allowlist_entry_is_reported() -> None:
    assert stale_entries([]) == [*REAL_CLOCK_SYMBOLS, *CLOCK_NAMING_PATHS]


def test_the_scan_names_the_path_and_line_of_a_test_that_reads_the_real_clock(
    tmp_path: Path,
) -> None:
    (tmp_path / "test_reads.py").write_text(
        "from datetime import UTC, datetime\ninvite(engine, datetime.now(UTC))\n"
    )

    assert tree_hits(tmp_path, tmp_path) == ["test_reads.py:2"]


def test_the_scan_names_a_module_outside_the_allowed_paths_that_names_system_clock(
    tmp_path: Path,
) -> None:
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "main.py").write_text("from app.clock import system_clock\n")
    (tmp_path / "app" / "service.py").write_text("from app.clock import system_clock\n")

    assert tree_hits(tmp_path, tmp_path) == ["app/service.py:1"]


def test_the_scan_names_a_wall_clock_read_outside_its_allowed_function(tmp_path: Path) -> None:
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "clock.py").write_text(
        "from datetime import UTC, datetime\n"
        "def system_clock():\n    return datetime.now(UTC)\n"
        "def other():\n    return datetime.now(UTC)\n"
    )

    assert tree_hits(tmp_path, tmp_path) == ["app/clock.py:5"]


@pytest.mark.parametrize(
    "source",
    [
        "from datetime import datetime as dt\nx = dt.now()\n",
        "from datetime import datetime\nx = datetime.now()\n",
        "import datetime\nx = datetime.datetime.now()\n",
        "import datetime as dt\nx = dt.datetime.utcnow()\n",
        "from datetime import datetime\nx = datetime.utcnow()\n",
        "from datetime import date\nx = date.today()\n",
        "from datetime import date as d\nx = d.today()\n",
        "import datetime\nx = datetime.date.today()\n",
        "from datetime import datetime\nx = field(default_factory=datetime.now)\n",
        "x = field(default_factory=datetime.now)\n",
        "import datetime\nx = field(default_factory=datetime.date.today)\n",
        "import time\nx = time.time()\n",
        "import time\nx = time.time_ns()\n",
        "import time as t\nx = t.time()\n",
        "from time import time as t\nx = t()\n",
        "from time import time_ns\nx = time_ns()\n",
        "from time import time\n",
        "from time import time_ns\n",
        "from datetime import datetime\nx = datetime.today()\n",
        "def f():\n    from datetime import datetime\n    return datetime.now()\n",
        "def f():\n    import time\n    return time.time()\n",
        "from app.clock import system_clock\n",
        "import app.clock\nx = app.clock.system_clock\n",
        "x = system_clock()\n",
        "import datetime as dt\nx = dt.datetime.now()\n",
        "from datetime import datetime as D\nx = D.now()\n",
        "from time import time\nx = time()\n",
        "from app.clock import system_clock as sc\nx = sc()\n",
        "from app import clock\nx = clock.system_clock\n",
    ],
)
def test_the_checker_flags_a_read_of_the_real_clock(source: str) -> None:
    assert real_clock_lines(source) != []


@pytest.mark.parametrize(
    "source",
    [
        "x = MovableClock(instant)()\n",
        "x = answer.today\n",
        "x = answer.now()\n",
        "from datetime import datetime\nx = answer.now()\n",
        "import datetime\nx = datetime.time(12, 0)\n",
        "import datetime\nx = datetime.datetime(2026, 1, 1)\n",
        "import datetime\nx = datetime.datetime.fromisoformat(text)\n",
        "from datetime import datetime\nx = datetime.time(12, 0)\n",
        "from datetime import date\nx = date.fromisoformat(text)\n",
        "from datetime import datetime\nx = datetime.combine(day, hour)\n",
        'x = "system_clock"\n',
        "import time\nx = time.sleep(0)\n",
        "import time\nx = time.monotonic()\n",
        "from time import monotonic\nx = monotonic()\n",
        "x = response.time\n",
        "x = vector[\"today\"]\n",
        "x = clock()\n",
        "x = obj.now()\n",
        'monkeypatch.setattr(m, "system_clock", clock)\n',
        "def f(date):\n    return date.today()\n",
    ],
)
def test_the_checker_lets_a_source_with_no_real_clock_through(source: str) -> None:
    assert real_clock_lines(source) == []
