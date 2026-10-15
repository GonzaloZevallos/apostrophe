"""No test under `tests/business_removal/` reads the real clock (ADR-0001). The scan
walks the syntax tree of every file in the directory, itself included, and names
`path:line` for each read of the real clock; the snippet tests prove the checker on
sources it must flag and sources it must let through.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

HERE = Path(__file__).parent
REAL_CLOCK_ATTRIBUTES = frozenset({"now", "utcnow", "today"})
CLOCK_GLOBAL = "system_clock"


def real_clock_lines(source: str) -> list[int]:
    """The line of every read of the real clock in `source`, in order."""
    tree = ast.parse(source)
    time_module_names = _names_bound_to_the_time_module(tree)
    lines: list[int] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            if node.attr in REAL_CLOCK_ATTRIBUTES or node.attr == CLOCK_GLOBAL:
                lines.append(node.lineno)
            elif (
                node.attr == "time"
                and isinstance(node.value, ast.Name)
                and node.value.id in time_module_names
            ):
                lines.append(node.lineno)
        elif isinstance(node, ast.Name) and node.id == CLOCK_GLOBAL:
            lines.append(node.lineno)
        elif isinstance(node, ast.ImportFrom):
            imported = {alias.name for alias in node.names}
            if CLOCK_GLOBAL in imported or (node.module == "time" and "time" in imported):
                lines.append(node.lineno)
    return sorted(lines)


def _names_bound_to_the_time_module(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "time":
                    names.add(alias.asname or "time")
    return names


def test_no_file_under_business_removal_reads_the_real_clock() -> None:
    hits = [
        f"{path.relative_to(HERE.parent.parent)}:{line}"
        for path in sorted(HERE.rglob("*.py"))
        for line in real_clock_lines(path.read_text())
    ]

    assert hits == []


@pytest.mark.parametrize(
    "source",
    [
        "from datetime import datetime as dt\nx = dt.now()\n",
        "from datetime import date\nx = date.today()\n",
        "x = field(default_factory=datetime.now)\n",
        "from datetime import datetime\nx = datetime.utcnow()\n",
        "from app.clock import system_clock\n",
        "import app.clock\nx = app.clock.system_clock\n",
        "import time\nx = time.time()\n",
        "import time as t\nx = t.time()\n",
        "from time import time\n",
    ],
)
def test_the_checker_flags_a_read_of_the_real_clock(source: str) -> None:
    assert real_clock_lines(source) != []


@pytest.mark.parametrize(
    "source",
    [
        "x = MovableClock(instant)()\n",
        "import datetime\nx = datetime.time(12, 0)\n",
        "from datetime import datetime\nx = datetime.time(12, 0)\n",
        'x = "system_clock"\n',
        "import time\nx = time.sleep(0)\n",
    ],
)
def test_the_checker_lets_a_source_with_no_real_clock_through(source: str) -> None:
    assert real_clock_lines(source) == []
