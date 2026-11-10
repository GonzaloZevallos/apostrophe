"""Only the money_format adapters write the `money_format` table (the rescale ADR).

Every module under `app/` outside `app/money_format/adapters/` and `app/migrations/` is
parsed with `ast` and flagged when it:

- calls `MoneyFormatRow(...)`;
- passes `MoneyFormatRow` or the string `"money_format"` to `insert(`, `update(` or `delete(`;
- holds a string that is an `UPDATE money_format` or `INSERT INTO money_format` statement.

The one exception is Business removal's reflected delete, which names tables only by
reflecting the schema and so never matches any of these. `findings_in` is exercised below on
sources it must reject, not only on the real tree.
"""

from __future__ import annotations

import ast
import re

from tests.architecture.hexagon import REPO_ROOT

WRITERS = frozenset({"insert", "update", "delete"})
STATEMENT = re.compile(r"\b(update|insert\s+(or\s+\w+\s+)?into)\s+money_format\b", re.IGNORECASE)


def _is_money_format(node: ast.expr) -> bool:
    if isinstance(node, ast.Attribute):
        # `MoneyFormatRow.__table__`, the mapped table spelled through its class.
        return _is_money_format(node.value)
    return (isinstance(node, ast.Name) and node.id == "MoneyFormatRow") or (
        isinstance(node, ast.Constant) and node.value == "money_format"
    )


def _called(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""


def findings_in(source: str) -> list[tuple[int, str]]:
    """Every write of `money_format` in `source` as `(line, what)`."""
    found: list[tuple[int, str]] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Call):
            name = _called(node)
            if name == "MoneyFormatRow":
                found.append((node.lineno, "MoneyFormatRow("))
            elif name in WRITERS and node.args and _is_money_format(node.args[0]):
                found.append((node.lineno, f"{name}(money_format)"))
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if STATEMENT.search(node.value):
                found.append((node.lineno, "a money_format statement"))
    return sorted(found)


def test_the_checker_flags_each_write_it_bans() -> None:
    assert findings_in("row = MoneyFormatRow(business_id=1)\n") == [(1, "MoneyFormatRow(")]
    assert findings_in("s.execute(update(MoneyFormatRow).values(scale=2))\n") == [
        (1, "update(money_format)")
    ]
    assert findings_in("s.execute(sa.insert('money_format'))\n") == [(1, "insert(money_format)")]
    assert findings_in("s.execute(delete(MoneyFormatRow))\n") == [(1, "delete(money_format)")]
    assert findings_in("s.execute(update(MoneyFormatRow.__table__))\n") == [
        (1, "update(money_format)")
    ]
    assert findings_in("text('UPDATE money_format SET scale = 2')\n") == [
        (1, "a money_format statement")
    ]
    assert findings_in("text('insert into money_format (a) values (1)')\n") == [
        (1, "a money_format statement")
    ]


def test_the_checker_leaves_reads_and_other_tables_alone() -> None:
    assert findings_in("select(MoneyFormatRow.symbol)\nupdate(ExpenseRow)\n") == []
    assert findings_in("text('SELECT scale FROM money_format')\nx = 'money_format'\n") == []


def test_only_the_money_format_adapters_write_money_format() -> None:
    app = REPO_ROOT / "app"
    scanned = [
        path
        for path in app.rglob("*.py")
        if "money_format/adapters" not in path.as_posix() and "migrations" not in path.parts
    ]
    assert scanned, "the scan found no modules"
    found = {
        f"{path.relative_to(REPO_ROOT)}:{line}": what
        for path in scanned
        for line, what in findings_in(path.read_text(encoding="utf-8"))
    }
    assert found == {}
