"""`payment.method` is frozen
(docs/adr/20261111-payment-methods-by-id): nothing under `app/` except the payment
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
_SQL_PAYMENT_ALIAS = re.compile(
    r"\b(?:from|join)\s+payment\s+(?:as\s+)?(?!(?:where|join|on|left|inner|group|order|limit)\b)(\w+)",
    re.IGNORECASE,
)


def _spells_aliased_column(text: str) -> bool:
    """`FROM payment p ... p.method`: the column named through the table's alias."""
    return any(
        re.search(rf"(?<![A-Za-z0-9_]){re.escape(alias)}\.method(?![A-Za-z0-9_])", text)
        for alias in _SQL_PAYMENT_ALIAS.findall(text)
    )


def _dotted(expression: ast.expr) -> str | None:
    """`a.b.c` as the string "a.b.c"; None for anything that is not a plain dotted name."""
    if isinstance(expression, ast.Name):
        return expression.id
    if isinstance(expression, ast.Attribute):
        head = _dotted(expression.value)
        return None if head is None else f"{head}.{expression.attr}"
    return None


def frozen_method_uses(source: str) -> list[str]:
    """The places a source names the frozen column: `PaymentRow.method`, a `method=`
    keyword of a `PaymentRow(...)` call, a string spelling `payment.method`."""
    found: list[str] = []
    tree = ast.parse(source)
    # `app/payments/domain/account.py` has its own, unrelated `PaymentRow`: only the
    # table class, imported from the payments adapters' tables, is the frozen one. It may
    # come in under another name, or through the tables module (`tables.PaymentRow`).
    row_names: set[str] = set()
    module_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "app.payments.adapters.tables":
            row_names |= {
                alias.asname or alias.name for alias in node.names if alias.name == "PaymentRow"
            }
        if isinstance(node, ast.ImportFrom) and node.module == "app.payments.adapters":
            module_names |= {
                alias.asname or alias.name for alias in node.names if alias.name == "tables"
            }
        if isinstance(node, ast.Import):
            module_names |= {
                alias.asname or alias.name
                for alias in node.names
                if alias.name == "app.payments.adapters.tables"
            }

    def is_row(expression: ast.expr) -> bool:
        if isinstance(expression, ast.Name):
            return expression.id in row_names
        return (
            isinstance(expression, ast.Attribute)
            and expression.attr == "PaymentRow"
            and _dotted(expression.value) in module_names
        )

    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr == "method":
            owner = node.value
            if is_row(owner):
                found.append(f"PaymentRow.method line {node.lineno}")
            # `PaymentRow.__table__.c.method`
            elif (
                isinstance(owner, ast.Attribute)
                and owner.attr == "c"
                and isinstance(owner.value, ast.Attribute)
                and owner.value.attr == "__table__"
                and is_row(owner.value.value)
            ):
                found.append(f"PaymentRow.__table__.c.method line {node.lineno}")
        if isinstance(node, ast.Call) and is_row(node.func):
            found += [
                f"PaymentRow(method=) line {node.lineno}"
                for keyword in node.keywords
                if keyword.arg == "method"
            ]
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and (_SQL_COLUMN.search(node.value) or _spells_aliased_column(node.value))
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


def test_the_frozen_column_is_reported_through_an_alias_a_module_or_the_table_object() -> None:
    source = (
        "from app.payments.adapters.tables import PaymentRow as Row\n"
        "from app.payments.adapters import tables\n"
        "import app.payments.adapters.tables as t\n"
        "a = Row.method\n"
        "b = tables.PaymentRow.method\n"
        "c = t.PaymentRow(business_id=1, method='cash')\n"
        "d = Row.__table__.c.method\n"
        "e = Row.payment_method_id\n"
    )

    assert frozen_method_uses(source) == [
        "PaymentRow(method=) line 6",
        "PaymentRow.__table__.c.method line 7",
        "PaymentRow.method line 4",
        "PaymentRow.method line 5",
    ]


def test_the_frozen_column_is_reported_through_an_unaliased_dotted_import() -> None:
    source = (
        "import app.payments.adapters.tables\n"
        "a = app.payments.adapters.tables.PaymentRow.method\n"
        "b = app.payments.adapters.tables.PaymentRow.payment_method_id\n"
    )

    assert frozen_method_uses(source) == ["PaymentRow.method line 2"]


def test_the_frozen_column_is_reported_through_a_sql_table_alias() -> None:
    source = (
        "a = text('SELECT p.method FROM payment p')\n"
        "b = text('SELECT x.method FROM payment AS x JOIN sale s ON s.id = x.sale_id')\n"
        "c = text('SELECT p.payment_method_id FROM payment p')\n"
        "d = text('SELECT s.method FROM sale s JOIN payment p ON p.sale_id = s.id')\n"
    )

    assert frozen_method_uses(source) == [
        "string 'SELECT p.method FROM payment p' line 1",
        "string 'SELECT x.method FROM payment AS x JOIN sale s ON s.id = x.sale_id' line 2",
    ]


def test_a_domain_class_that_is_also_called_payment_row_is_not_the_table() -> None:
    assert frozen_method_uses("a = PaymentRow(method='cash')\n") == []
