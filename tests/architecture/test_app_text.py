"""No Spanish app text in the backend (GH-53, app-text.md): every string constant and
f-string literal part in `app/**/*.py` and the operator scripts is read with the marker
list the front's guard shares (`web/src/architecture/spanishMarkers.json`): the accented
letters and `¿ ¡`, and a closed stoplist of unambiguous Spanish words.

The guard parses files and reads nothing else, so it gives the same verdict on any date.
Docstrings are skipped (they are for the developer, not for a person using the app).
Seller data and the sheet's own words are not app text: the exempt paths are a closed list,
each with its reason, and a test fails when an entry matches no file.
"""

from __future__ import annotations

import ast
import json
import re
from collections.abc import Iterable
from pathlib import Path, PurePosixPath

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MARKERS_PATH = REPO_ROOT / "web" / "src" / "architecture" / "spanishMarkers.json"

SCANNED_GLOBS = (
    "app/**/*.py",
    "scripts/drill.py",
    "scripts/backup_copy.py",
    "scripts/newest_backup.py",
)

# Closed list: a pattern (a glob from the repo root) and why that path may hold Spanish.
EXEMPT: dict[str, str] = {
    "app/migrations/**": "a migration is history: it keeps the Spanish seeds it wrote (ADR-0003)",
    "app/spreadsheet_import/adapters/layout.py": "the sheet's own tab names, titles and cells",
    "app/spreadsheet_import/adapters/cells.py": "the sheet's own words for Pago, Tipo and Origen",
    "app/spreadsheet_import/domain/rows.py": "the sheet's tab and column words a problem names",
    "app/catalog/adapters/import_port.py": "the sheet's own two values of Catálogo's shown column",
}


def _markers() -> tuple[str, frozenset[str]]:
    data = json.loads(MARKERS_PATH.read_text(encoding="utf-8"))
    return str(data["characters"]), frozenset(str(word) for word in data["words"])


def _docstring_nodes(tree: ast.AST) -> set[int]:
    skipped: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            first = node.body[0] if node.body else None
            if (
                isinstance(first, ast.Expr)
                and isinstance(first.value, ast.Constant)
                and isinstance(first.value.value, str)
            ):
                skipped.add(id(first.value))
    return skipped


def spanish_in(text: str) -> str | None:
    """The marker `text` trips (a character or a stoplist word), or `None`."""
    characters, words = _markers()
    for character in text:
        if character in characters:
            return character
    for token in re.findall(r"[^\W\d_]+", text.casefold()):
        if token in words:
            return str(token)
    return None


def violations(source: str) -> list[tuple[int, str]]:
    """Every `(line, marker)` of a string constant or f-string part that trips a marker."""
    tree = ast.parse(source)
    docstrings = _docstring_nodes(tree)
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and id(node) not in docstrings
        ):
            marker = spanish_in(node.value)
            if marker is not None:
                found.append((node.lineno, marker))
    return sorted(found)


def _is_exempt(relative: str, exempt: Iterable[str]) -> bool:
    return any(PurePosixPath(relative).full_match(pattern) for pattern in exempt)


def scan(root: Path, exempt: Iterable[str] = tuple(EXEMPT)) -> dict[str, list[tuple[int, str]]]:
    exempt = tuple(exempt)
    found: dict[str, list[tuple[int, str]]] = {}
    for pattern in SCANNED_GLOBS:
        for path in sorted(root.glob(pattern)):
            relative = path.relative_to(root).as_posix()
            if _is_exempt(relative, exempt):
                continue
            hits = violations(path.read_text(encoding="utf-8"))
            if hits:
                found[relative] = hits
    return found


def test_the_real_tree_has_no_spanish_app_text() -> None:
    assert scan(REPO_ROOT) == {}


def test_every_exempt_entry_names_a_file_and_a_reason() -> None:
    for pattern, reason in EXEMPT.items():
        assert reason.strip(), pattern
        assert any(REPO_ROOT.glob(pattern)), f"{pattern} matches nothing: drop it"


def test_a_spanish_message_is_refused(tmp_path: Path) -> None:
    module = tmp_path / "app" / "sales" / "domain"
    module.mkdir(parents=True)
    (module / "rules.py").write_text(
        'class Broken(ValueError):\n    """Una regla."""\n\n\n'
        'def check(n: int) -> None:\n    if n:\n        raise Broken("No se puede borrar")\n'
        '    raise Broken(f"Tenés {n} ventas")\n',
        encoding="utf-8",
    )

    found = scan(tmp_path)

    assert found == {"app/sales/domain/rules.py": [(7, "borrar"), (8, "ventas"), (8, "é")]}


def test_an_accent_alone_is_refused(tmp_path: Path) -> None:
    assert violations('MESSAGE = "Está bien"\n') == [(1, "á")]
    assert violations('MESSAGE = f"Total: {1} de hoy"\n') == [(1, "de")]


def test_a_sheet_word_passes_only_on_an_exempt_path(tmp_path: Path) -> None:
    layout = tmp_path / "app" / "spreadsheet_import" / "adapters"
    layout.mkdir(parents=True)
    (layout / "layout.py").write_text('SHEET = "Catálogo"\n', encoding="utf-8")
    other = tmp_path / "app" / "spreadsheet_import" / "application"
    other.mkdir(parents=True)
    (other / "report.py").write_text('SHEET = "Catálogo"\n', encoding="utf-8")

    assert scan(tmp_path) == {"app/spreadsheet_import/application/report.py": [(1, "á")]}


def test_docstrings_formats_and_english_words_pass() -> None:
    source = (
        '"""Una explicación para quien lee el código."""\n'
        'DEFAULTS = ("Growing supplies", "Packaging", "Shipping and travel", "Other")\n'
        'HEADER = "\\U0001f33f **CATALOG** \\U0001f33f"\n'
        'FOOTER = "\\U0001f4e9 Questions and orders by private message."\n'
        'LINE = f"• {1}% indica / {2}% sativa"\n'
        'AROMA = "• Aroma/flavour: sweet"\n'
        'PRICE = "• Price per gram: $11.000"\n'
        'BULK = "• From 2,5 g: $10.000 each"\n'
        'NOTHING = "Nothing to offer for now."\n'
    )
    assert violations(source) == []


def test_the_changed_constants_are_no_longer_their_spanish_values() -> None:
    from app.catalog.domain import header_footer, text
    from app.expenses.domain.category import DEFAULT_CATEGORY_NAMES

    assert set(DEFAULT_CATEGORY_NAMES).isdisjoint(
        {"Insumos de cultivo", "Envíos y traslados", "Otros"}
    )
    assert header_footer.DEFAULT_HEADER != "\U0001f33f **CATÁLOGO** \U0001f33f"
    assert header_footer.DEFAULT_FOOTER != "\U0001f4e9 Consultas y pedidos por privado."
    assert text.NOTHING_TO_OFFER != "Por ahora no tenemos nada para ofrecer."
    assert text.NOTHING_TO_OFFER == "Nothing to offer for now."
    for constant in (
        *DEFAULT_CATEGORY_NAMES,
        header_footer.DEFAULT_HEADER,
        header_footer.DEFAULT_FOOTER,
        text.NOTHING_TO_OFFER,
    ):
        assert spanish_in(constant) is None, constant


@pytest.mark.parametrize("word", ["Packaging", "Aroma/flavour", "indica", "sativa"])
def test_the_marker_list_does_not_hit_the_english_words_of_the_catalog(word: str) -> None:
    assert spanish_in(word) is None
