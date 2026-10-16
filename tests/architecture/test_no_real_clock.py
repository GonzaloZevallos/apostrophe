"""No code under `app/` or `tests/` reads the real clock (ADR-0001: the clock is
injected), except the exact paths in `REAL_CLOCK_ALLOWED`. The scan parses every `.py`
file, resolves what each import binds, and names `path:line` for each read of the real
clock; the snippet tests prove the checker on sources it must flag and sources it must
let through.

Flagged, however the names are imported (the module, the class or an alias, at the top
of the file or re-imported inside a function), whether called or only referenced
(`default_factory=datetime.now`): `datetime.now`, `datetime.utcnow`, `date.today`,
`time.time`, `time.time_ns`, and any use or import of `system_clock`.

Allowed on purpose: `time.monotonic` and `time.sleep` (a wait deadline measures
elapsed time, it is not a wall clock) and any attribute that merely shares a name
(`answer.today`). `scripts/` is out of scope.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent.parent
SCANNED = ("app", "tests")
FIXTURES = Path("tests/architecture/fixtures")

# Exact paths, as data: the clock itself and the composition roots, which hand
# `system_clock` to the app. Never a directory, never a pattern.
REAL_CLOCK_ALLOWED: dict[str, str] = {
    "app/clock.py": "defines system_clock",
    "app/main.py": "create_app's default clock",
    "app/accounts/adapters/cli.py": "composition root of the accounts command line",
    "app/business_removal/adapters/cli.py": "composition root of the removal command line",
    "app/spreadsheet_import/adapters/cli.py": "composition root of the import command line",
    "tests/e2e_app.py": (
        "the e2e backend shares the real clock with the CLI subprocess and the browser "
        "by design (ADR-0040)"
    ),
}

CLOCK_GLOBAL = "system_clock"
DATETIME_READS = frozenset({"now", "utcnow", "today"})
DATE_READS = frozenset({"today"})
TIME_READS = frozenset({"time", "time_ns"})


class _Bindings:
    """What the names a file imports stand for, wherever the import sits."""

    def __init__(self, tree: ast.AST) -> None:
        self.time_modules: set[str] = set()
        self.datetime_modules: set[str] = set()
        self.datetime_classes: set[str] = set()
        self.date_classes: set[str] = set()
        self.time_functions: set[str] = set()
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    bound = alias.asname or alias.name
                    imported.add(bound.split(".")[0])
                    if alias.name == "time":
                        self.time_modules.add(bound)
                    elif alias.name == "datetime":
                        self.datetime_modules.add(bound)
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    bound = alias.asname or alias.name
                    imported.add(bound)
                    if node.module == "datetime" and alias.name == "datetime":
                        self.datetime_classes.add(bound)
                    elif node.module == "datetime" and alias.name == "date":
                        self.date_classes.add(bound)
                    elif node.module == "time" and alias.name in TIME_READS:
                        self.time_functions.add(bound)
        # A bare `datetime` or `date` that no import binds (a star import, a re-export) is
        # still the standard library's.
        if "datetime" not in imported:
            self.datetime_classes.add("datetime")
        if "date" not in imported:
            self.date_classes.add("date")

    def reads_the_real_clock(self, node: ast.Attribute) -> bool:
        owner = node.value
        if isinstance(owner, ast.Name):
            return (
                (node.attr in DATETIME_READS and owner.id in self.datetime_classes)
                or (node.attr in DATE_READS and owner.id in self.date_classes)
                or (node.attr in TIME_READS and owner.id in self.time_modules)
            )
        if (
            isinstance(owner, ast.Attribute)
            and isinstance(owner.value, ast.Name)
            and owner.value.id in self.datetime_modules
        ):
            return (owner.attr == "datetime" and node.attr in DATETIME_READS) or (
                owner.attr == "date" and node.attr in DATE_READS
            )
        return False


def real_clock_lines(source: str) -> list[int]:
    """The line of every read of the real clock in `source`, in order."""
    tree = ast.parse(source)
    bindings = _Bindings(tree)
    lines: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            if node.attr == CLOCK_GLOBAL or bindings.reads_the_real_clock(node):
                lines.add(node.lineno)
        elif isinstance(node, ast.Name):
            if node.id == CLOCK_GLOBAL or node.id in bindings.time_functions:
                lines.add(node.lineno)
        elif isinstance(node, ast.ImportFrom):
            imported = {alias.name for alias in node.names}
            if CLOCK_GLOBAL in imported or (node.module == "time" and imported & TIME_READS):
                lines.add(node.lineno)
    return sorted(lines)


def unexpected_reads(root: Path, allowed: dict[str, str]) -> list[str]:
    """`path:line` of every read of the real clock under `root`'s scanned trees that is
    not in an allowed path."""
    hits: list[str] = []
    for tree in SCANNED:
        for path in sorted((root / tree).rglob("*.py")):
            relative = path.relative_to(root)
            if relative.as_posix() in allowed or relative.is_relative_to(FIXTURES):
                continue
            hits.extend(
                f"{relative.as_posix()}:{line}" for line in real_clock_lines(path.read_text())
            )
    return hits


def test_no_file_under_app_or_tests_reads_the_real_clock() -> None:
    assert unexpected_reads(ROOT, REAL_CLOCK_ALLOWED) == []


def test_every_allowed_path_exists_and_has_a_reason() -> None:
    missing = [path for path in REAL_CLOCK_ALLOWED if not (ROOT / path).is_file()]

    assert missing == []
    assert all(REAL_CLOCK_ALLOWED.values())


def test_the_scan_names_a_read_outside_the_allowed_paths_and_lets_an_allowed_one_through(
    tmp_path: Path,
) -> None:
    (tmp_path / "app").mkdir()
    (tmp_path / "tests").mkdir()
    (tmp_path / "app" / "reads.py").write_text("import time\nx = time.time()\n")
    (tmp_path / "app" / "allowed.py").write_text("import time\nx = time.time()\n")
    (tmp_path / "tests" / "reads.py").write_text("from app.clock import system_clock\n")

    hits = unexpected_reads(tmp_path, {"app/allowed.py": "composition root"})

    assert hits == ["app/reads.py:2", "tests/reads.py:1"]


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
    ],
)
def test_the_checker_lets_a_source_with_no_real_clock_through(source: str) -> None:
    assert real_clock_lines(source) == []
