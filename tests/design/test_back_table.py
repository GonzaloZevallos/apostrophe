"""navigation.md's back-with-no-history table against the screens.json registry (GH-135).

The three sources of a screen's parent (`web/src/routes.ts`, `scripts/design/screens.json`
and that table) are chained: ADR-0033's cross-check keeps the first equal to the second,
and this keeps the second equal to the third. Each Spanish screen name maps to the registry
paths it stands for in the map below; a row with no entry, or a mapped screen with no row,
fails.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NAVIGATION = ROOT / "docs" / "product" / "navigation.md"
SCREENS_JSON = ROOT / "scripts" / "design" / "screens.json"

HEADER = "| Screen | Back with no history goes to |"

ONBOARDING_PATHS = (
    "/onboarding",
    "/onboarding/variety",
    "/onboarding/stock",
    "/onboarding/catalog-message",
    "/onboarding/bot",
    "/onboarding/partner",
    "/onboarding/categories",
    "/onboarding/done",
)

# Each row's screen: the registry paths it stands for, and which field of the registry row
# holds its parent ("archived_parent" for the archived variety's page).
SCREENS: dict[str, tuple[tuple[str, ...], str]] = {
    "Nueva variedad": (("/varieties/new",), "parent"),
    "Nuevo precio": (("/varieties/{id}/prices/new",), "parent"),
    "Stock entry form, new": (("/varieties/entries/new",), "parent"),
    "Stock entry form, editing": (("/varieties/entries/{id}",), "parent"),
    "Customer form, new": (("/customers/new",), "parent"),
    "Customer form, editing": (("/customers/{id}/edit",), "parent"),
    "Registrar cobro": (("/customers/{id}/payment",), "parent"),
    'A variety\'s "Ver todas" of prices or entries': (
        ("/varieties/{id}/prices", "/varieties/{id}/entries"),
        "parent",
    ),
    '"Todas las entradas"': (("/varieties/entries",), "parent"),
    "Stock withdrawal form, new": (("/withdrawals/new",), "parent"),
    "Stock withdrawal form, editing": (("/withdrawals/{id}/edit",), "parent"),
    "A withdrawal's detail": (("/withdrawals/{id}",), "parent"),
    "Archivadas": (("/varieties/archived",), "parent"),
    "An archived variety's page": (("/varieties/{id}",), "archived_parent"),
    'An Onboarding step or "Listo"': (ONBOARDING_PATHS, "parent"),
}

TARGETS: dict[str, str] = {
    "Variedades": "/varieties",
    "that variety's page": "/varieties/{id}",
    "the variety's page": "/varieties/{id}",
    "Clientes": "/customers",
    "that customer's card": "/customers/{id}",
    '"Todas las entradas"': "/varieties/entries",
    "that withdrawal's detail": "/withdrawals/{id}",
    "Archivadas": "/varieties/archived",
    "Inicio": "/",
}


def normalise(path: str) -> str:
    return re.sub(r"\{[a-z_]+\}", "{id}", path)


def table_rows(markdown: str) -> list[tuple[str, str]]:
    """The (screen, target) cells of the back-with-no-history table."""
    lines = markdown.splitlines()
    start = lines.index(HEADER)
    rows: list[tuple[str, str]] = []
    for line in lines[start + 2 :]:
        if not line.startswith("|"):
            break
        screen, target = (cell.strip() for cell in line.strip().strip("|").split("|"))
        rows.append((screen, target))
    return rows


def table_problems(markdown: str, registry: list[dict[str, str]]) -> list[str]:
    """What is wrong between the table and the registry's parents; empty when they agree."""
    by_path = {normalise(row["path"]): row for row in registry}
    rows = table_rows(markdown)
    problems = [f"{name}: no row in the table" for name in SCREENS if name not in dict(rows)]
    for screen, target in rows:
        if screen not in SCREENS:
            problems.append(f"{screen}: not mapped to a screen")
            continue
        if target not in TARGETS:
            problems.append(f"{screen}: target {target!r} not mapped to a path")
            continue
        paths, field = SCREENS[screen]
        for path in paths:
            row = by_path.get(path)
            if row is None:
                problems.append(f"{screen}: {path} is not in the registry")
                continue
            have = row.get(field)
            if have is None or normalise(have) != TARGETS[target]:
                problems.append(
                    f"{screen}: the table says {TARGETS[target]}, {field} of {path} is {have}"
                )
    return problems


def _registry() -> list[dict[str, str]]:
    registry: list[dict[str, str]] = json.loads(SCREENS_JSON.read_text())["registry"]
    return registry


def test_every_row_of_the_back_table_is_its_screens_registry_parent() -> None:
    assert table_problems(NAVIGATION.read_text(), _registry()) == []


def test_a_reverted_stock_entry_new_parent_is_refused() -> None:
    registry = [
        {**row, "parent": "/varieties/entries"} if row["path"] == "/varieties/entries/new" else row
        for row in _registry()
    ]

    assert table_problems(NAVIGATION.read_text(), registry) == [
        "Stock entry form, new: the table says /varieties, "
        "parent of /varieties/entries/new is /varieties/entries"
    ]


def test_an_archived_variety_with_no_archived_parent_is_refused() -> None:
    registry = [
        {key: value for key, value in row.items() if key != "archived_parent"}
        for row in _registry()
    ]

    assert table_problems(NAVIGATION.read_text(), registry) == [
        "An archived variety's page: the table says /varieties/archived, "
        "archived_parent of /varieties/{id} is None"
    ]


def test_a_row_with_no_mapping_and_a_missing_row_are_refused() -> None:
    markdown = NAVIGATION.read_text()
    unmapped = markdown.replace(
        "| Nueva variedad | Variedades |", "| Pantalla nueva | Variedades |"
    )

    assert table_problems(unmapped, _registry()) == [
        "Nueva variedad: no row in the table",
        "Pantalla nueva: not mapped to a screen",
    ]
