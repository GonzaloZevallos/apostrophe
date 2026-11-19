"""How a module's imports resolve to dotted names, shared by the architecture scans."""

from __future__ import annotations

import ast


def imported_module(node: ast.ImportFrom, package: tuple[str, ...]) -> str | None:
    """The absolute dotted module a `from` import names; a relative one is resolved
    against `package`, the dotted directory of the file that holds it."""
    if not node.level:
        return node.module
    if node.level - 1 > len(package):
        return None
    base = package[: len(package) - (node.level - 1)]
    return ".".join([*base, *([node.module] if node.module else [])])


def import_table(tree: ast.AST, package: tuple[str, ...]) -> dict[str, str]:
    """local name -> the dotted thing it stands for ("dt" -> "datetime")."""
    table: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.asname:
                    table[alias.asname] = alias.name
                else:
                    top = alias.name.split(".")[0]
                    table[top] = top
        elif isinstance(node, ast.ImportFrom):
            module = imported_module(node, package)
            for alias in node.names:
                if module is not None:
                    table[alias.asname or alias.name] = f"{module}.{alias.name}"
    return table
