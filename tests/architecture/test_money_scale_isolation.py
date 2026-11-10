"""The money scale is applied only inside an adapter (docs/adr/0058).

No module under a hexagon's `domain/` or `application/` directory, nor the shared kernel
`app/shared/`, imports `app.db`'s money helpers (`money_scale_factor`, `money_stored_value`,
`scaled`) or reads the stored `scale`. The checker parses each file with `ast`, so comments
and strings never count, and flags:

- an import of one of the helpers from `app.db` (aliased or not), or `from app import db`
  followed by `db.<helper>` / `import app.db` followed by `app.db.<helper>`;
- an attribute `.scale` read off a name or attribute called `money_format`, or off
  `MoneyFormatRow`.

`findings_in` is exercised below on sources it must reject, not only on the real tree.
"""

from __future__ import annotations

import ast

from tests.architecture.hexagon import REPO_ROOT

HELPERS = frozenset({"money_scale_factor", "money_stored_value", "scaled"})
SCALE_HOLDERS = frozenset({"money_format", "MoneyFormatRow"})


def findings_in(source: str) -> list[tuple[int, str]]:
    """Every banned reference in `source` as `(line, what)`."""
    found: list[tuple[int, str]] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.ImportFrom) and node.module == "app.db":
            found.extend((node.lineno, a.name) for a in node.names if a.name in HELPERS)
        elif isinstance(node, ast.Attribute):
            if node.attr in HELPERS and _dotted(node.value) in {"app.db", "db"}:
                found.append((node.lineno, node.attr))
            elif node.attr == "scale" and _dotted(node.value).rsplit(".", 1)[-1] in SCALE_HOLDERS:
                found.append((node.lineno, f"{_dotted(node.value)}.scale"))
    return sorted(found)


def _dotted(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_dotted(node.value)}.{node.attr}"
    return ""


def _scanned_files() -> list[str]:
    app = REPO_ROOT / "app"
    files = [
        path
        for pattern in ("*/domain/**/*.py", "*/application/**/*.py", "shared/**/*.py")
        for path in app.glob(pattern)
    ]
    return sorted(str(path.relative_to(REPO_ROOT)) for path in files)


def test_the_checker_flags_each_form_it_bans() -> None:
    assert findings_in("from app.db import money_scale_factor as f, scaled\n") == [
        (1, "money_scale_factor"),
        (1, "scaled"),
    ]
    assert findings_in("from app.db import money_stored_value\n") == [(1, "money_stored_value")]
    assert findings_in("import app.db\nx = app.db.scaled(c, 1)\n") == [(2, "scaled")]
    assert findings_in("from app import db\nx = db.money_scale_factor(s, 1)\n") == [
        (2, "money_scale_factor")
    ]
    assert findings_in("x = row.money_format.scale\ny = MoneyFormatRow.scale\n") == [
        (1, "row.money_format.scale"),
        (2, "MoneyFormatRow.scale"),
    ]


def test_the_checker_leaves_unrelated_code_alone() -> None:
    assert findings_in("from app.db import Base, money_column\nx = chart.scale\n") == []


def test_no_domain_application_or_shared_module_touches_the_scale() -> None:
    files = _scanned_files()
    assert files, "the scan found no modules"

    offenders = {
        path: found
        for path in files
        if (found := findings_in((REPO_ROOT / path).read_text(encoding="utf-8")))
    }

    assert offenders == {}
