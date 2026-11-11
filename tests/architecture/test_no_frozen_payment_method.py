"""`payment.method` is frozen (docs/adr/0084): nothing under `app/` except the payment
table's own definition and the migrations names `PaymentRow.method`, builds a `PaymentRow`
with a `method=` keyword, or spells `payment.method` in a SQL string. A payment's method is
`payment_method_id`; its label is read through the `payment_method` join."""

from __future__ import annotations

import ast
import re
from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT

TABLE_DEFINITION = "app/payments/adapters/tables.py"
_SQL_COLUMN = re.compile(r"(?<![A-Za-z0-9_])payment\.method(?![A-Za-z0-9_])")


def frozen_method_uses(source: str) -> list[str]:
    """The places a source names the frozen column: `PaymentRow.method`, a `method=`
    keyword of a `PaymentRow(...)` call, a string spelling `payment.method`."""
    found: list[str] = []
    tree = ast.parse(source)
    # `app/payments/domain/account.py` has its own, unrelated `PaymentRow`: only the
    # table class, imported from the payments adapters' tables, is the frozen one.
    is_table = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "app.payments.adapters.tables"
        and any(alias.name == "PaymentRow" for alias in node.names)
        for node in ast.walk(tree)
    )
    for node in ast.walk(tree):
        if (
            is_table
            and isinstance(node, ast.Attribute)
            and node.attr == "method"
            and isinstance(node.value, ast.Name)
            and node.value.id == "PaymentRow"
        ):
            found.append(f"PaymentRow.method line {node.lineno}")
        if (
            is_table
            and isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "PaymentRow"
        ):
            found += [
                f"PaymentRow(method=) line {node.lineno}"
                for keyword in node.keywords
                if keyword.arg == "method"
            ]
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and _SQL_COLUMN.search(node.value)
        ):
            found.append(f"string {node.value!r} line {node.lineno}")
    return sorted(found)


def _app_files() -> list[Path]:
    return sorted(
        path
        for path in (REPO_ROOT / "app").rglob("*.py")
        if "migrations" not in path.relative_to(REPO_ROOT).parts
        and str(path.relative_to(REPO_ROOT)) != TABLE_DEFINITION
    )


def test_no_code_outside_the_payment_table_and_the_migrations_names_the_frozen_column() -> None:
    files = _app_files()
    assert files

    used = {
        str(path.relative_to(REPO_ROOT)): frozen_method_uses(path.read_text()) for path in files
    }

    assert {path: found for path, found in used.items() if found} == {}


def test_the_frozen_column_is_reported_in_each_spelling() -> None:
    source = (
        "from app.payments.adapters.tables import PaymentRow\n"
        "a = PaymentRow.method\n"
        "b = PaymentRow(business_id=1, method='cash')\n"
        "c = text('SELECT payment.method FROM payment')\n"
        "d = PaymentRow.payment_method_id\n"
        "e = text('SELECT payment.payment_method_id FROM payment')\n"
    )

    assert frozen_method_uses(source) == [
        "PaymentRow(method=) line 3",
        "PaymentRow.method line 2",
        "string 'SELECT payment.method FROM payment' line 4",
    ]


def test_a_domain_class_that_is_also_called_payment_row_is_not_the_table() -> None:
    assert frozen_method_uses("a = PaymentRow(method='cash')\n") == []
