"""No route is Spanish (task GH-53, "Routes ... none is left in Spanish").

The redirect table `app/legacy_front_paths.json` lists the old Spanish paths and is left
untouched. A path in the route registry or in the design registry never reuses one of the
words of an old path, and every path is ASCII.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY = REPO_ROOT / "app" / "legacy_front_paths.json"
ROUTES_TS = REPO_ROOT / "web" / "src" / "routes.ts"
SCREENS_JSON = REPO_ROOT / "scripts" / "design" / "screens.json"

PATH_KEYS = ("path", "route", "parent")


def segments(path: str) -> set[str]:
    """The words of a path, leaving out parameters (`{id}`, `:token`) and the empty root."""
    return {s for s in path.split("/") if s and not s.startswith((":", "{"))}


def old_words(table: list[dict[str, str]]) -> set[str]:
    """The segments of every old path that its new path does not keep."""
    words: set[str] = set()
    for row in table:
        words |= segments(row["old"]) - segments(row["now"])
    return words


def spanish_paths(paths: Iterable[str], banned: set[str]) -> list[str]:
    """Each path that carries a banned word or a non-ASCII character, sorted."""
    return sorted({p for p in paths if segments(p) & banned or not p.isascii()})


def routes_ts_paths(source: str) -> list[str]:
    return re.findall(r"""['"`](/[^'"`\s]*)['"`]""", source)


def screens_json_paths(data: dict[str, list[dict[str, object]]]) -> list[str]:
    found: list[str] = []
    for group in ("screens", "registry"):
        for row in data[group]:
            found += [v for k, v in row.items() if k in PATH_KEYS and isinstance(v, str)]
    return found


def _legacy() -> list[dict[str, str]]:
    table: list[dict[str, str]] = json.loads(LEGACY.read_text(encoding="utf-8"))
    return table


def test_the_legacy_table_has_old_spanish_words() -> None:
    assert {"ventas", "clientes", "variedades"} <= old_words(_legacy())


def test_no_path_of_the_route_registry_is_spanish() -> None:
    paths = routes_ts_paths(ROUTES_TS.read_text(encoding="utf-8"))
    assert len(paths) > 20
    assert spanish_paths(paths, old_words(_legacy())) == []


def test_no_path_of_the_design_registry_is_spanish() -> None:
    paths = screens_json_paths(json.loads(SCREENS_JSON.read_text(encoding="utf-8")))
    assert len(paths) > 20
    assert spanish_paths(paths, old_words(_legacy())) == []


def test_a_spanish_or_non_ascii_path_is_refused() -> None:
    banned = old_words(_legacy())
    paths = ["/sales", "/ventas/nueva", "/customers/{id}", "/clientes", "/más"]
    assert spanish_paths(paths, banned) == ["/clientes", "/más", "/ventas/nueva"]


def test_the_scanners_read_both_files_shapes() -> None:
    assert routes_ts_paths("export const A = '/sales/:id'") == ["/sales/:id"]
    data: dict[str, list[dict[str, object]]] = {
        "screens": [{"route": "/login", "path": "/login"}],
        "registry": [{"path": "/a", "parent": "/b"}],
    }
    assert screens_json_paths(data) == ["/login", "/login", "/a", "/b"]
