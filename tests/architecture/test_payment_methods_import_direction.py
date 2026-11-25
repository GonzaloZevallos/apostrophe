"""The dependency between `payment_methods` and the hexagons that point at it runs one way:
`app.main` wires `app.payments` and `app.expenses` into `AnyUsage`. Nothing under
`app/payment_methods` imports either of them, adapters included, which the hexagon rules
(domain and application only) do not cover
(docs/adr/20261124-a-payment-method-is-in-use-when-any-payment-or-expense-points-at-it)."""

from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT, full_imports_of

PAYMENT_METHODS = REPO_ROOT / "app" / "payment_methods"
FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "payment_methods_reaching_payments_and_expenses"
    / "adapters_bad.py"
)
FORBIDDEN = ("app.payments", "app.expenses")


def modules_reaching_records(root: Path) -> list[str]:
    """Every `module: import` under `root` that is `app.payments`, `app.expenses` or inside."""
    return sorted(
        f"{module.relative_to(root)}: {imported}"
        for module in root.rglob("*.py")
        for imported in full_imports_of(module)
        if any(imported == name or imported.startswith(f"{name}.") for name in FORBIDDEN)
    )


def test_nothing_under_payment_methods_imports_payments_or_expenses() -> None:
    assert any(PAYMENT_METHODS.rglob("*.py"))
    assert modules_reaching_records(PAYMENT_METHODS) == []


def test_the_check_reports_a_payment_methods_module_that_imports_payments_or_expenses() -> None:
    found = modules_reaching_records(FIXTURE.parent)

    assert found == [
        "adapters_bad.py: app.expenses.adapters.tables.ExpenseRow",
        "adapters_bad.py: app.payments.adapters.tables.PaymentRow",
    ]
