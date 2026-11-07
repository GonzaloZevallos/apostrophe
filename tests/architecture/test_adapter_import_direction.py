"""The dependency between `customers` and `customer_types` runs one way:
`customers.adapters` -> `customer_types.adapters`. Nothing under `app/customer_types`
imports `app.customers` (the count of customers in a type reaches it as a port from
`app.main`), and each side imports cleanly on its own, in a fresh interpreter, so a
cycle cannot hide behind an import order another test happened to set up."""

import subprocess
import sys
from pathlib import Path

import pytest

from tests.architecture.hexagon import REPO_ROOT, full_imports_of

CUSTOMER_TYPES = REPO_ROOT / "app" / "customer_types"
FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "customer_types_reaching_customers"
    / "adapters_bad.py"
)


def modules_reaching_customers(root: Path) -> list[str]:
    """Every `module: import` under `root` that is `app.customers` or inside it."""
    return sorted(
        f"{module.relative_to(root)}: {imported}"
        for module in root.rglob("*.py")
        for imported in full_imports_of(module)
        if imported == "app.customers" or imported.startswith("app.customers.")
    )


def test_nothing_under_customer_types_imports_customers() -> None:
    assert any(CUSTOMER_TYPES.rglob("*.py"))
    assert modules_reaching_customers(CUSTOMER_TYPES) == []


def test_the_check_reports_a_customer_types_module_that_imports_customers() -> None:
    found = modules_reaching_customers(FIXTURE.parent)

    assert found == ["adapters_bad.py: app.customers.adapters.tables.CustomerRow"]


@pytest.mark.parametrize(
    "module", ["app.customer_types.adapters", "app.customers.adapters", "app.tables"]
)
def test_each_side_imports_cleanly_alone(module: str) -> None:
    result = subprocess.run(
        [sys.executable, "-c", f"import {module}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
