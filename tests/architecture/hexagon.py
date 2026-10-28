"""The import rules of a hexagon (docs/adr/0001), checked by parsing, never importing:

- `domain/` imports the standard library, its own domain package and `app.shared`.
- `application/` never imports a framework, the database layer or an adapter.
- `application/` never imports the copy module, Babel or gettext either (ADR-0051): text born
  there reaches it through a port declared in `application/`.
- `domain/` and `application/` never import another hexagon's package (only their own,
  `app.shared`, and the standard library).
- `domain/` never imports the copy module or Babel (ADR-0050): texts reach it as plain
  values through ports declared in `application/`.
- `adapters/` may import anything.

A relative import is resolved the way `importlib` does, so spelling an import
relatively never slips past a rule.
"""

from __future__ import annotations

import ast
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

SHARED_KERNEL = "app.shared"
APPLICATION_FORBIDDEN_ROOTS = ("fastapi", "starlette", "sqlalchemy", "alembic", "pydantic")
APPLICATION_FORBIDDEN_MODULES = (
    "app.db",
    "app.tables",
    "app.migrations",
    "app.shared.copy",
    "babel",
    "gettext",
)
DOMAIN_FORBIDDEN_MODULES = ("app.shared.copy", "babel")


@dataclass(frozen=True)
class Violation:
    module: Path
    imported: str
    rule: str


@dataclass(frozen=True)
class ScanResult:
    domain_modules: tuple[Path, ...]
    application_modules: tuple[Path, ...]
    violations: tuple[Violation, ...]


def scan_hexagon(root: Path, other_hexagons: frozenset[str] = frozenset()) -> ScanResult:
    domain_modules = _python_files(root / "domain")
    application_modules = _python_files(root / "application")
    domain_package = dotted(root / "domain")
    violations = (
        *(
            Violation(module, imported, "domain-imports-stdlib-and-shared-only")
            for module in domain_modules
            for imported in imports_of(module)
            if not (
                is_stdlib(imported)
                or _within(imported, domain_package)
                or _within(imported, SHARED_KERNEL)
            )
        ),
        *(
            Violation(module, imported, "domain-imports-no-copy")
            for module in domain_modules
            for imported in full_imports_of(module)
            if any(_within(imported, forbidden) for forbidden in DOMAIN_FORBIDDEN_MODULES)
        ),
        *(
            Violation(module, imported, "application-imports-no-framework-or-adapter")
            for module in application_modules
            for imported in full_imports_of(module)
            if _forbidden_for_application(imported)
        ),
        *(
            Violation(module, imported, "domain-and-application-import-no-other-hexagon")
            for module in (*domain_modules, *application_modules)
            for imported in full_imports_of(module)
            if any(_within(imported, other) for other in other_hexagons)
        ),
    )
    return ScanResult(domain_modules, application_modules, violations)


def imports_of(module: Path) -> Iterator[str]:
    tree = ast.parse(module.read_text(), filename=str(module))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level == 0:
                if node.module:
                    yield node.module
            else:
                yield _resolve_relative(module, node)


def full_imports_of(module: Path) -> Iterator[str]:
    """Every name a statement in `module` binds, with a `from X import name` or its
    relative equivalent resolved to `X.name` rather than the bare `X`.

    `imports_of` stops at the bare module for `from app import varieties`, because the
    other rules only ever check a module's own dotted name against an allow-list of
    packages. The no-other-hexagon rule needs the imported name too, so `from app
    import varieties` and `from ... import varieties` (written where `...` reaches
    `app`) are both seen as reaching `app.products`, not the harmless-looking `app`.
    """
    tree = ast.parse(module.read_text(), filename=str(module))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = node.module if node.level == 0 else _resolve_relative(module, node)
            yield from (f"{base}.{alias.name}" for alias in node.names)


def is_stdlib(module_name: str) -> bool:
    return module_name.split(".")[0] in sys.stdlib_module_names


def _python_files(directory: Path) -> tuple[Path, ...]:
    return tuple(sorted(directory.rglob("*.py"))) if directory.is_dir() else ()


def dotted(path: Path) -> str:
    return ".".join(path.relative_to(REPO_ROOT).parts)


def _resolve_relative(module: Path, node: ast.ImportFrom) -> str:
    package = dotted(module.parent).split(".")
    base = package[: len(package) - (node.level - 1)]
    return ".".join([*base, node.module] if node.module else base)


def _within(module_name: str, package: str) -> bool:
    return module_name == package or module_name.startswith(package + ".")


def _forbidden_for_application(module_name: str) -> bool:
    return (
        module_name.split(".")[0] in APPLICATION_FORBIDDEN_ROOTS
        or any(_within(module_name, m) for m in APPLICATION_FORBIDDEN_MODULES)
        or "adapters" in module_name.split(".")
    )
