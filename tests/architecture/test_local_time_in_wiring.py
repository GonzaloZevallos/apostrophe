"""Where a time zone is applied (GH-497, plan invariant 4).

- No module under `app/*/adapters/` calls `.astimezone(`: an adapter hands the domain the
  stored UTC instant, and only the domain turns it into a local time (`today_series`).
- No module under `app/*/domain/` imports `zoneinfo` or `app.clock`: the domain takes the
  zone as a `tzinfo` argument.

The scan parses each file (never a text search) and resolves imports through
`tests/architecture/imports.py`, aliases and relative imports included. Both allowlists are
closed and start empty; an entry that no longer matches is reported as stale.
"""

from __future__ import annotations

import ast
from collections.abc import Iterable
from pathlib import Path, PurePosixPath

from tests.architecture.imports import imported_module

REPO_ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN_DOMAIN_MODULES = ("zoneinfo", "app.clock")

# Closed: `path:line` of an adapter call or a domain import that stays, with its reason.
ADAPTER_ASTIMEZONE_ALLOWED: frozenset[str] = frozenset()
DOMAIN_IMPORT_ALLOWED: frozenset[str] = frozenset()


def astimezone_calls(source: str, path: str) -> list[str]:
    """`path:line` of every `.astimezone(` call in `source`."""
    return [
        f"{path}:{node.lineno}"
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "astimezone"
    ]


def _forbidden(name: str) -> bool:
    return any(
        name == module or name.startswith(f"{module}.") for module in FORBIDDEN_DOMAIN_MODULES
    )


def forbidden_domain_imports(source: str, path: str) -> list[str]:
    """`path:line` of every import in `source` that resolves to `zoneinfo` or `app.clock`,
    or to a name inside them (`from app.clock import business_day`, `from app import clock`)."""
    tree = ast.parse(source)
    package = PurePosixPath(path).parent.parts
    hits: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(_forbidden(alias.name) for alias in node.names):
                hits.add(f"{path}:{node.lineno}")
        elif isinstance(node, ast.ImportFrom):
            module = imported_module(node, package)
            if module is None:
                continue
            if _forbidden(module) or any(_forbidden(f"{module}.{a.name}") for a in node.names):
                hits.add(f"{path}:{node.lineno}")
    return sorted(hits)


def _files(base: Path, pattern: str) -> list[Path]:
    return sorted(base.glob(pattern))


def adapter_hits(base: Path) -> list[str]:
    return [
        hit
        for file in _files(base, "app/*/adapters/**/*.py")
        for hit in astimezone_calls(file.read_text(), file.relative_to(base).as_posix())
    ]


def domain_hits(base: Path) -> list[str]:
    return [
        hit
        for file in _files(base, "app/*/domain/**/*.py")
        for hit in forbidden_domain_imports(file.read_text(), file.relative_to(base).as_posix())
    ]


def stale(allowed: Iterable[str], hits: Iterable[str]) -> list[str]:
    seen = set(hits)
    return [entry for entry in allowed if entry not in seen]


def test_no_adapter_converts_a_time_to_local() -> None:
    hits = adapter_hits(REPO_ROOT)

    assert [hit for hit in hits if hit not in ADAPTER_ASTIMEZONE_ALLOWED] == []


def test_no_domain_module_imports_zoneinfo_or_the_app_clock() -> None:
    hits = domain_hits(REPO_ROOT)

    assert [hit for hit in hits if hit not in DOMAIN_IMPORT_ALLOWED] == []


def test_every_allowlist_entry_still_matches_a_hit() -> None:
    assert stale(ADAPTER_ASTIMEZONE_ALLOWED, adapter_hits(REPO_ROOT)) == []
    assert stale(DOMAIN_IMPORT_ALLOWED, domain_hits(REPO_ROOT)) == []


def test_a_stale_allowlist_entry_is_reported() -> None:
    assert stale({"app/x/adapters/a.py:3"}, []) == ["app/x/adapters/a.py:3"]


def test_the_adapter_scan_names_the_line_of_an_astimezone_call(tmp_path: Path) -> None:
    adapters = tmp_path / "app" / "sales" / "adapters"
    adapters.mkdir(parents=True)
    (adapters / "ledger.py").write_text(
        "def read(row, tz):\n    local = row.recorded_at.astimezone(tz)\n    return local\n"
    )
    (adapters / "clean.py").write_text("def read(row):\n    return row.recorded_at\n")
    (tmp_path / "app" / "sales" / "domain").mkdir()
    (tmp_path / "app" / "sales" / "domain" / "ok.py").write_text("x = stamp.astimezone(tz)\n")

    assert adapter_hits(tmp_path) == ["app/sales/adapters/ledger.py:2"]


def test_the_adapter_scan_sees_an_astimezone_call_through_an_alias_of_the_instant(
    tmp_path: Path,
) -> None:
    adapters = tmp_path / "app" / "sales" / "adapters" / "deep"
    adapters.mkdir(parents=True)
    (adapters / "m.py").write_text("moment = row.recorded_at\nlocal = (moment).astimezone(zone)\n")

    assert adapter_hits(tmp_path) == ["app/sales/adapters/deep/m.py:2"]


def test_the_domain_scan_names_zoneinfo_and_app_clock_imports_with_aliases(
    tmp_path: Path,
) -> None:
    domain = tmp_path / "app" / "results" / "domain"
    domain.mkdir(parents=True)
    (domain / "plain.py").write_text("import zoneinfo\n")
    (domain / "aliased.py").write_text(
        "import zoneinfo as zi\nfrom zoneinfo import ZoneInfo as Z\nimport app.clock as c\n"
        "from app import clock\nfrom app.clock import business_day as day\n"
    )
    (domain / "fine.py").write_text(
        "from datetime import tzinfo\nfrom app.shared import calendar\n"
    )

    assert domain_hits(tmp_path) == [
        "app/results/domain/aliased.py:1",
        "app/results/domain/aliased.py:2",
        "app/results/domain/aliased.py:3",
        "app/results/domain/aliased.py:4",
        "app/results/domain/aliased.py:5",
        "app/results/domain/plain.py:1",
    ]


def test_the_domain_scan_names_a_relative_import_of_the_app_clock(tmp_path: Path) -> None:
    domain = tmp_path / "app" / "results" / "domain"
    domain.mkdir(parents=True)
    (domain / "relative.py").write_text(
        "from ... import clock\nfrom ...clock import business_day\nfrom . import figures\n"
    )

    assert domain_hits(tmp_path) == [
        "app/results/domain/relative.py:1",
        "app/results/domain/relative.py:2",
    ]
