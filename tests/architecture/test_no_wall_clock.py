"""No Python test reads the real clock (ADR-0043).

A test that reads the wall clock passes today and fails once the calendar moves past an
expiry or a day boundary, which is what turned GH-142's gate red. `wall_clock_reads` walks
the AST of a module and names every read of a date or an instant from the system:
`datetime.now`, `utcnow`, `today`, `date.today`, `time.time`, `time.time_ns`, and any import
of `system_clock`. Import aliases are resolved, so `from datetime import datetime as dt`
does not hide `dt.now()`.

`time.monotonic`, `perf_counter` and `sleep` are not flagged: they measure no date. How long
something took is ADR-0038's rule, not this guard's.
"""

from __future__ import annotations

import ast
from collections.abc import Mapping
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TESTS = REPO_ROOT / "tests"
FIXTURES = Path(__file__).resolve().parent / "fixtures"

# Shrink-only: an exact path (relative to the repo root) and why it may read the real clock.
# Another entry is allowed only for a test of the app's own clock whose verdict is the same
# on any date and at any hour; anything else is fixed with a controlled clock.
ALLOWED: Mapping[str, str] = {
    "tests/e2e_app.py": (
        "the e2e backend shares the real clock with the CLI subprocess and the browser "
        "by design (ADR-0040)"
    ),
}

# module -> the attribute names that read a date or an instant from the system.
_READS: Mapping[str, frozenset[str]] = {
    "datetime.datetime": frozenset({"now", "utcnow", "today"}),
    "datetime.date": frozenset({"today"}),
    "time": frozenset({"time", "time_ns"}),
}
_SYSTEM_CLOCK = ("app.clock", "system_clock")


def wall_clock_reads(module: Path) -> list[str]:
    """Every read of the real clock in `module`, as `path:line: <what>`."""
    tree = ast.parse(module.read_text(), filename=str(module))
    # local name -> the dotted thing it stands for ("dt" -> "datetime.datetime").
    names: dict[str, str] = {}
    reads: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names[alias.asname or alias.name.split(".")[0]] = (
                    alias.name if alias.asname else alias.name.split(".")[0]
                )
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            for alias in node.names:
                names[alias.asname or alias.name] = f"{node.module}.{alias.name}"
                if (node.module, alias.name) == _SYSTEM_CLOCK:
                    reads.append(f"{module}:{node.lineno}: imports system_clock")
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            owner = _dotted(node.value, names)
            if owner in _READS and node.attr in _READS[owner]:
                reads.append(f"{module}:{node.lineno}: {owner}.{node.attr}")
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            # `from time import time_ns as ns` read bare: the name itself is the read.
            target = names.get(node.id, "")
            owner, _, attribute = target.rpartition(".")
            if owner == "time" and attribute in _READS["time"]:
                reads.append(f"{module}:{node.lineno}: {target}")
    return sorted(set(reads))


def _dotted(node: ast.expr, names: Mapping[str, str]) -> str:
    """The dotted name `node` stands for after resolving import aliases, or ''."""
    if isinstance(node, ast.Name):
        return names.get(node.id, "")
    if isinstance(node, ast.Attribute):
        owner = _dotted(node.value, names)
        return f"{owner}.{node.attr}" if owner else ""
    return ""


def test_a_direct_datetime_now_is_flagged() -> None:
    assert wall_clock_reads(FIXTURES / "wall_clock_direct.py") != []


def test_reads_through_every_import_alias_are_flagged() -> None:
    reads = wall_clock_reads(FIXTURES / "wall_clock_aliased.py")

    assert [read.split(": ", 1)[1] for read in reads] == [
        "datetime.datetime.utcnow",
        "datetime.date.today",
        "datetime.datetime.today",
        "time.time",
        "time.time_ns",
    ]


def test_importing_system_clock_is_flagged() -> None:
    assert wall_clock_reads(FIXTURES / "wall_clock_system_clock.py") != []


def test_monotonic_perf_counter_and_sleep_are_not_flagged() -> None:
    assert wall_clock_reads(FIXTURES / "wall_clock_free.py") == []


def test_every_allowed_entry_exists_and_still_needs_its_entry() -> None:
    stale = [
        path
        for path in ALLOWED
        if not (REPO_ROOT / path).exists() or wall_clock_reads(REPO_ROOT / path) == []
    ]

    assert stale == []


def test_no_test_reads_the_real_clock_outside_allowed() -> None:
    findings = [
        read
        for module in sorted(TESTS.rglob("*.py"))
        if FIXTURES not in module.parents
        and module.relative_to(REPO_ROOT).as_posix() not in ALLOWED
        for read in wall_clock_reads(module)
    ]

    assert findings == []
