"""The frozen columns `PriceEntryRow.vip_price` and `CustomerRow.is_vip` (docs/adr/0059) are
read and written by nothing but the migrations and the two table definitions: the VIP price
lives in `customer_type_price` rows and VIP membership in the VIP customer type. An AST walk
over `app/`, `scripts/` and `tests/` finds every `PriceEntryRow.vip_price` /
`CustomerRow.is_vip` attribute access and every `PriceEntryRow(vip_price=...)` /
`CustomerRow(is_vip=...)` call."""

from __future__ import annotations

import ast

from tests.architecture.hexagon import REPO_ROOT

FROZEN: dict[str, str] = {"PriceEntryRow": "vip_price", "CustomerRow": "is_vip"}
ROOTS = ("app", "scripts", "tests")
# The only homes of the two columns: the migrations, their tests and the two tables.
ALLOWED_PREFIXES = ("app/migrations/", "tests/migrations/")
ALLOWED_FILES = frozenset(
    {
        "app/products/adapters/tables.py",
        "app/customers/adapters/tables.py",
        # This guard spells the names to look for them.
        "tests/architecture/test_frozen_columns.py",
    }
)
OFFENDER = REPO_ROOT / "tests" / "architecture" / "fixtures" / "frozen_column_reader.py"


def frozen_uses(source: str) -> list[str]:
    """Every `<Row>.<column>` access and `<Row>(<column>=...)` call of a frozen column."""
    found: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and FROZEN.get(node.value.id) == node.attr
        ):
            found.append(f"{node.value.id}.{node.attr} line {node.lineno}")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            column = FROZEN.get(node.func.id)
            found += [
                f"{node.func.id}({column}=...) line {node.lineno}"
                for keyword in node.keywords
                if column is not None and keyword.arg == column
            ]
    return found


def _offenders() -> list[str]:
    found: list[str] = []
    for root in ROOTS:
        for path in sorted((REPO_ROOT / root).rglob("*.py")):
            relative = path.relative_to(REPO_ROOT).as_posix()
            if relative in ALLOWED_FILES or relative.startswith(ALLOWED_PREFIXES):
                continue
            if "/fixtures/" in relative:
                continue
            found += [f"{relative}: {use}" for use in frozen_uses(path.read_text())]
    return found


def test_nothing_reads_or_writes_the_frozen_columns() -> None:
    assert _offenders() == []


def test_the_guard_rejects_a_reader_and_a_writer_of_the_frozen_columns() -> None:
    uses = frozen_uses(OFFENDER.read_text())

    assert uses == [
        "PriceEntryRow.vip_price line 6",
        "CustomerRow.is_vip line 7",
        "PriceEntryRow(vip_price=...) line 8",
    ]
