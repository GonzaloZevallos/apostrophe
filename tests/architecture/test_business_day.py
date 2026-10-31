"""One way to a business day (docs/adr/0057): no code in `app` or `scripts` works out a day
without the zone of its own business.

An AST walk over every Python file of `app` and `scripts` (the tests are outside the
literal-zone rule: the e2e app and the mobile harness name Argentina on purpose, but
`BUSINESS_TIMEZONE` is gone from them too):

- `BUSINESS_TIMEZONE` appears nowhere in `app`, `scripts` or `tests`.
- `ZoneInfo(<string literal>)` appears nowhere in `app` or `scripts`: a zone comes from a
  stored name through `load_zone`, never from a name written in code.
- `business_day` is defined only in `app/shared/calendar.py`.
- `business_day` is named (imported or reached as an attribute) only by `BUSINESS_DAY_USERS`,
  a closed list: each of those files passes the zone of the business it serves.
- `.astimezone(zone)` appears only in `app/shared/calendar.py`. A conversion to `UTC` never
  learns a day (it normalises an instant for storage or a name), so it is allowed anywhere.

A file outside the list fails, and the fixtures below prove each rule rejects what it must.
"""

from __future__ import annotations

import ast
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CALENDAR = "app/shared/calendar.py"

# Closed. Where `business_day` may be named in `app` and `scripts`, with the reason.
BUSINESS_DAY_USERS: dict[str, str] = {
    CALENDAR: "defines it",
    "app/accounts/adapters/deps.py": "get_today: the request's day, in the session business's zone",
    "app/pinned_catalog/adapters/sql_due.py": "the due rule, per business, in its own zone",
    "app/pinned_catalog/adapters/safe_upkeep.py": "the upkeep's today, from the committed zone",
    "app/pinned_catalog/application/push.py": "the date of the last send, in the current zone",
    "app/spreadsheet_import/adapters/cli.py": "the import's today, in the target's zone",
}


def _python_files(root: Path, areas: Iterable[str]) -> list[Path]:
    return sorted(
        path
        for area in areas
        if (root / area).is_dir()
        for path in (root / area).rglob("*.py")
        if ".venv" not in path.parts and "__pycache__" not in path.parts
    )


def _relative(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _names(tree: ast.AST, wanted: str) -> list[int]:
    """The lines where `wanted` is a name, an attribute, or an imported name."""
    lines: list[int] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == wanted:
            lines.append(node.lineno)
        elif isinstance(node, ast.Attribute) and node.attr == wanted:
            lines.append(node.lineno)
        elif isinstance(node, ast.alias) and node.name.split(".")[-1] == wanted:
            lines.append(node.lineno)
    return lines


def _is_zone_info_call(node: ast.Call) -> bool:
    function = node.func
    return (isinstance(function, ast.Name) and function.id == "ZoneInfo") or (
        isinstance(function, ast.Attribute) and function.attr == "ZoneInfo"
    )


def _literal_zone_lines(tree: ast.AST) -> list[int]:
    lines: list[int] = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and _is_zone_info_call(node)):
            continue
        arguments = [*node.args, *(keyword.value for keyword in node.keywords)]
        first = arguments[0] if arguments else None
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            lines.append(node.lineno)
    return lines


def _definition_lines(tree: ast.AST, wanted: str) -> list[int]:
    return [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and node.name == wanted
    ]


def _astimezone_lines(tree: ast.AST) -> list[int]:
    lines: list[int] = []
    for node in ast.walk(tree):
        if not (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "astimezone"
        ):
            continue
        only = node.args[0] if len(node.args) == 1 and not node.keywords else None
        if isinstance(only, ast.Name) and only.id == "UTC":
            continue
        lines.append(node.lineno)
    return lines


def violations(root: Path) -> list[str]:
    found: list[str] = []
    for path in _python_files(root, ("app", "scripts", "tests")):
        relative = _relative(root, path)
        tree = ast.parse(path.read_text(), filename=relative)
        found += [f"{relative}:{n} BUSINESS_TIMEZONE" for n in _names(tree, "BUSINESS_TIMEZONE")]
        if relative.startswith("tests/"):
            continue
        found += [f"{relative}:{n} ZoneInfo(literal)" for n in _literal_zone_lines(tree)]
        if relative != CALENDAR:
            found += [
                f"{relative}:{n} business_day defined"
                for n in _definition_lines(tree, "business_day")
            ]
            found += [f"{relative}:{n} astimezone" for n in _astimezone_lines(tree)]
        if relative not in BUSINESS_DAY_USERS:
            found += [f"{relative}:{n} business_day" for n in _names(tree, "business_day")]
    return found


def test_the_repository_has_one_way_to_a_business_day() -> None:
    assert violations(REPO_ROOT) == []


def test_every_file_of_the_closed_list_exists() -> None:
    assert [path for path in BUSINESS_DAY_USERS if not (REPO_ROOT / path).is_file()] == []


def _tree(root: Path, files: dict[str, str]) -> Path:
    for relative, source in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)
    return root


CALENDAR_SOURCE = "def business_day(instant, zone):\n    return instant.astimezone(zone).date()\n"


def test_the_walk_rejects_each_forbidden_shape(tmp_path: Path) -> None:
    root = _tree(
        tmp_path,
        {
            CALENDAR: CALENDAR_SOURCE,
            "app/a.py": "from app.clock import BUSINESS_TIMEZONE\n",
            "app/b.py": "from zoneinfo import ZoneInfo\nZONE = ZoneInfo('Europe/Madrid')\n",
            "app/c.py": "import zoneinfo\nZONE = zoneinfo.ZoneInfo(key='Europe/Madrid')\n",
            "app/d.py": "from app.shared.calendar import business_day\n",
            "app/e.py": "from app.shared import calendar\nx = calendar.business_day(1, 2)\n",
            "app/f.py": "def business_day(instant):\n    return instant\n",
            "app/g.py": "def f(instant, zone):\n    return instant.astimezone(zone).date()\n",
            "scripts/h.py": "from app.shared.calendar import business_day\n",
            "tests/i.py": "x = BUSINESS_TIMEZONE\n",
        },
    )

    assert violations(root) == [
        "app/a.py:1 BUSINESS_TIMEZONE",
        "app/b.py:2 ZoneInfo(literal)",
        "app/c.py:2 ZoneInfo(literal)",
        "app/d.py:1 business_day",
        "app/e.py:2 business_day",
        "app/f.py:1 business_day defined",
        "app/g.py:2 astimezone",
        "scripts/h.py:1 business_day",
        "tests/i.py:1 BUSINESS_TIMEZONE",
    ]


def test_the_walk_accepts_what_the_rules_allow(tmp_path: Path) -> None:
    root = _tree(
        tmp_path,
        {
            CALENDAR: CALENDAR_SOURCE,
            "app/accounts/adapters/deps.py": "from app.shared.calendar import business_day\n",
            "app/db.py": "from datetime import UTC\n\ndef f(value):\n    return value.astimezone(UTC)\n",
            "app/loader.py": "from zoneinfo import ZoneInfo\n\ndef load(name):\n    return ZoneInfo(name)\n",
            "tests/j.py": "from app.shared.calendar import business_day\nZ = ZoneInfo('UTC')\n",
        },
    )

    assert violations(root) == []
