"""The frozen columns `PriceEntryRow.vip_price` and `CustomerRow.is_vip` (docs/adr/0059) are
read and written by nothing but the migrations and the two table definitions: the VIP price
lives in `customer_type_price` rows and VIP membership in the VIP customer type. An AST walk
over `app/`, `scripts/` and `tests/` finds every simple statement that names one of the two
row classes (under any import alias) and spells its column anywhere in the same statement:
`Row.column`, `Row(column=...)`, `update(Row).values(column=...)`, `Row.__table__.c.column`,
`getattr(Row, "column")`. A read through an instance the statement does not tie to the class
(`row.column` alone on a line) is beyond a syntax walk and stays with review."""

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


def _aliases(tree: ast.AST) -> dict[str, str]:
    """The names a module binds a frozen row class to (`import ... as Alias` included),
    each mapped to the column that class froze."""
    bound: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name in FROZEN:
                    bound[alias.asname or alias.name] = FROZEN[alias.name]
    return bound


def _spells(node: ast.AST, column: str) -> int | None:
    """The line where `node` spells the column: an attribute (`x.column`, also
    `__table__.c.column`), a keyword (`values(column=...)`) or a string (`"column"`)."""
    if isinstance(node, ast.Attribute) and node.attr == column:
        return node.lineno
    if isinstance(node, ast.keyword) and node.arg == column:
        return node.value.lineno
    if isinstance(node, ast.Constant) and node.value == column:
        return node.lineno
    return None


def frozen_uses(source: str) -> list[str]:
    """Every simple statement that names a frozen row class and spells its column."""
    tree = ast.parse(source)
    bound = _aliases(tree)
    found: list[str] = []
    for statement in ast.walk(tree):
        if not isinstance(statement, ast.stmt) or hasattr(statement, "body"):
            continue
        names = {node.id for node in ast.walk(statement) if isinstance(node, ast.Name)}
        for name in sorted(names & set(bound)):
            found += [
                f"{name}.{bound[name]} line {line}"
                for node in ast.walk(statement)
                if (line := _spells(node, bound[name])) is not None
            ]
    return sorted(found, key=lambda use: int(use.rsplit(" ", 1)[1]))


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


def test_the_guard_rejects_every_way_of_reaching_a_frozen_column() -> None:
    uses = frozen_uses(OFFENDER.read_text())

    assert uses == [
        "PriceEntryRow.vip_price line 10",
        "CustomerRow.is_vip line 11",
        "PriceEntryRow.vip_price line 12",
        "Entry.vip_price line 13",
        "PriceEntryRow.vip_price line 14",
        "PriceEntryRow.vip_price line 15",
    ]
