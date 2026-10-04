"""The hexagon import rules over every capability (docs/adr/0001).

A capability adds its package to `HEXAGON_ROOTS` in the same diff that creates it.
Each root must contribute modules: a checker pointed at the wrong path stays green
forever over zero files.
"""

from pathlib import Path

import pytest

from tests.architecture.hexagon import REPO_ROOT, dotted, imports_of, is_stdlib, scan_hexagon

FIXTURES = Path(__file__).resolve().parent / "fixtures"
HEXAGON_ROOTS = (
    REPO_ROOT / "app" / "accounts",
    REPO_ROOT / "app" / "varieties",
    REPO_ROOT / "app" / "customers",
    REPO_ROOT / "app" / "expenses",
    REPO_ROOT / "app" / "payments",
    REPO_ROOT / "app" / "sales",
    REPO_ROOT / "app" / "stock",
    REPO_ROOT / "app" / "catalog",
    REPO_ROOT / "app" / "results",
    REPO_ROOT / "app" / "spreadsheet_import",
)
ALL_HEXAGON_NAMES = frozenset(dotted(root) for root in HEXAGON_ROOTS)
SHARED_KERNEL_MODULES = tuple(sorted((REPO_ROOT / "app" / "shared").glob("*.py")))
# Stands in for a sibling hexagon that `relative_cross_hexagon.py` reaches with dots
# alone (`from ... import sibling_hexagon`), the way `app/accounts/application` would
# reach `app.varieties` with the same number of dots. No such package needs to exist:
# the checker only parses import statements, it never imports them.
FIXTURE_SIBLING_HEXAGON = "tests.architecture.fixtures.sibling_hexagon"


def test_the_checker_reports_the_deliberate_violations() -> None:
    # Proven negative: the checker must be seen to fail before it is trusted to pass.
    other_hexagons = ALL_HEXAGON_NAMES | {FIXTURE_SIBLING_HEXAGON}

    result = scan_hexagon(FIXTURES / "bad_hexagon", other_hexagons=other_hexagons)

    assert sorted((v.imported, v.rule) for v in result.violations) == [
        ("app.varieties", "domain-and-application-import-no-other-hexagon"),
        (
            "app.varieties.domain.variety.Variety",
            "domain-and-application-import-no-other-hexagon",
        ),
        ("sqlalchemy.orm", "domain-imports-stdlib-and-shared-only"),
        (
            "tests.architecture.fixtures.bad_hexagon.adapters",
            "application-imports-no-framework-or-adapter",
        ),
        (
            "tests.architecture.fixtures.sibling_hexagon",
            "domain-and-application-import-no-other-hexagon",
        ),
    ]


@pytest.mark.parametrize("root", HEXAGON_ROOTS, ids=[root.name for root in HEXAGON_ROOTS])
def test_each_hexagon_keeps_its_import_rules(root: Path) -> None:
    other_hexagons = ALL_HEXAGON_NAMES - {dotted(root)}

    result = scan_hexagon(root, other_hexagons=other_hexagons)

    assert len(result.domain_modules) > 0
    assert len(result.application_modules) > 0
    assert result.violations == ()


@pytest.mark.parametrize(
    "module", SHARED_KERNEL_MODULES, ids=[m.stem for m in SHARED_KERNEL_MODULES]
)
def test_the_shared_kernel_imports_only_the_standard_library(module: Path) -> None:
    assert [name for name in imports_of(module) if not is_stdlib(name)] == []
