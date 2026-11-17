"""The Catalog's text module writes no currency symbol: the symbol is the business's own
`MoneyFormat` (GH-318). Docstrings may show an example; no other string may hold a `$`."""

import ast
from pathlib import Path

TEXT_MODULE = Path(__file__).resolve().parents[2] / "app" / "catalog" / "domain" / "text.py"


def dollar_literals(source: str) -> list[int]:
    """The lines of every string literal holding a `$`, docstrings aside."""
    tree = ast.parse(source)
    docstrings: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            first = node.body[0] if node.body else None
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant):
                docstrings.add(id(first.value))
    return [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and "$" in node.value
        and id(node) not in docstrings
    ]


def test_the_catalog_text_module_holds_no_dollar_literal() -> None:
    assert dollar_literals(TEXT_MODULE.read_text(encoding="utf-8")) == []


def test_a_dollar_literal_outside_a_docstring_is_found() -> None:
    source = '"""doc $1"""\n\ndef money() -> str:\n    """doc $2"""\n    return "$" + "x"\n'

    assert dollar_literals(source) == [5]
