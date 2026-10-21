"""No Spanish in the back (GH-53, ADR-0049): a Python string literal under `app/` holds no
Spanish character and no word of the frozen denylist (`tests/fixtures/spanish_copy.json`).

The scan reads literals by AST, so a comment, an identifier or a column name is never read.
Its known limits are in ADR-0049: a Spanish text built from pieces (`"No" + "hay"` is two
literals, each judged alone), one with no accent and no denylisted word, and a text read
from a file that is not Python. A docstring is documentation, not a text a person reads,
and English ones name the glossary's Spanish words (Probarlo, Ventas), so docstrings are
not read.

Three lists decide what the real tree may hold: `ALLOWLIST` (closed: files that stay
Spanish for good, one reason each), `PENDING_SPANISH` (shrink-only: the files B1 and B2 of
GH-53 translate; each says how many Spanish literals it may still hold) and nothing else.
"""

from __future__ import annotations

import ast
import json
import re
from collections.abc import Collection, Iterable
from fnmatch import fnmatchcase
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = REPO_ROOT / "app"
DENYLIST_FILE = REPO_ROOT / "tests" / "fixtures" / "spanish_copy.json"

SPANISH_CHARACTERS = re.compile("[áéíóúñ¿¡ÁÉÍÓÚÑ]")
WORD = re.compile(r"[^\W\d_]+")

# Files that stay Spanish for good, relative to the repo root (glob), one reason each.
# Closed: a new entry needs a reason a reviewer accepts.
ALLOWLIST: dict[str, str] = {
    "app/migrations/versions/*": (
        "a migration is never edited (invariant 4); it may quote the Spanish defaults it once wrote"
    ),
    "app/legacy_front_paths.json": (
        "the legacy Spanish routes are redirected exactly as today (ADR-0024, ADR-0033); "
        "not Python, listed so the exemption is on record"
    ),
    "app/spreadsheet_import/adapters/layout.py": (
        "the import recognises the Spanish sheet: its tabs and column titles (invariant 7)"
    ),
    "app/spreadsheet_import/adapters/cells.py": (
        "the import recognises the Spanish sheet's values: Compra, Efectivo, Sí/No (invariant 7)"
    ),
}

# Today's Spanish files: path relative to the repo root -> the most Spanish literals it may
# hold. Shrink-only: B1 and B2 empty it; an entry whose file has no hit fails, a file not
# listed that has a hit fails, and a count above the one written fails.
PENDING_SPANISH: dict[str, int] = {
    # The import's plan and report words, and the sheet values they quote (B1). The plan
    # and the two import ports spell the sheet's own names as literals: B1 keeps what the
    # sheet recognises (invariant 7) and moves only the report's words.
    "app/catalog/adapters/import_port.py": 1,
    "app/spreadsheet_import/adapters/report.py": 2,
    "app/spreadsheet_import/domain/plan.py": 27,
    "app/stock/adapters/import_port.py": 4,
}


def load_denylist(path: Path = DENYLIST_FILE) -> frozenset[str]:
    """The denylisted words long enough to judge, `shared_words` (valid English too) out."""
    data = json.loads(path.read_text())
    minimum: int = data["min_word_length"]
    shared: set[str] = set(data["shared_words"])
    return frozenset(
        word for word in data["denylist"] if len(word) >= minimum and word not in shared
    )


def spanish_literals(source: str, denylist: Collection[str]) -> list[tuple[int, str]]:
    """Each string literal of `source` that is Spanish, as (line, literal): it holds a
    Spanish character, or a word (case aside) of `denylist`."""
    tree = ast.parse(source)
    docstrings = _docstrings(tree)
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if node not in docstrings and _is_spanish(node.value, denylist):
                found.append((node.lineno, node.value))
    return sorted(found)


def _docstrings(tree: ast.Module) -> list[ast.Constant]:
    """The module, class and function docstring nodes of `tree`."""
    found: list[ast.Constant] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            first = node.body[0] if node.body else None
            if (
                isinstance(first, ast.Expr)
                and isinstance(first.value, ast.Constant)
                and isinstance(first.value.value, str)
            ):
                found.append(first.value)
    return found


def _is_spanish(text: str, denylist: Collection[str]) -> bool:
    if SPANISH_CHARACTERS.search(text):
        return True
    return any(word.lower() in denylist for word in WORD.findall(text))


def spanish_counts(root: Path, denylist: Collection[str], allowed: Iterable[str]) -> dict[str, int]:
    """For each `.py` file under `root` that is not allowed, the number of Spanish literals
    it holds, keyed by its path relative to the repo root; files with none are left out.
    `allowed` are globs relative to the repo root."""
    patterns = tuple(allowed)
    counts: dict[str, int] = {}
    for path in sorted(root.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        relative = path.relative_to(REPO_ROOT).as_posix()
        if any(fnmatchcase(relative, pattern) for pattern in patterns):
            continue
        hits = len(spanish_literals(path.read_text(), denylist))
        if hits:
            counts[relative] = hits
    return counts


def refusals(counts: dict[str, int], pending: dict[str, int]) -> list[str]:
    """What the tree breaks against `pending`: a Spanish file not listed, a listed file with
    no hit left (delete the entry), a listed file with more hits than written."""
    problems: list[str] = []
    for path, hits in counts.items():
        if path not in pending:
            problems.append(f"{path}: {hits} Spanish literal(s), not pending")
        elif hits > pending[path]:
            problems.append(f"{path}: {hits} Spanish literal(s), above the {pending[path]} allowed")
    for path in pending:
        if path not in counts:
            problems.append(f"{path}: no Spanish literal left, delete the entry")
    return problems


# --- the helper, on fixtures -------------------------------------------------------------

FIXTURE_DENYLIST = frozenset({"guardá", "venta", "cliente", "nueva"})


def test_a_literal_with_a_spanish_character_is_flagged() -> None:
    source = 'a = "Año"\nb = "¿Seguro?"\nc = "plain"\n'
    assert spanish_literals(source, FIXTURE_DENYLIST) == [(1, "Año"), (2, "¿Seguro?")]


def test_a_literal_with_a_denylisted_word_is_flagged_in_any_case() -> None:
    source = 'a = "Nueva Venta"\nb = "save the cliente"\nc = "the sale"\n'
    assert spanish_literals(source, FIXTURE_DENYLIST) == [
        (1, "Nueva Venta"),
        (2, "save the cliente"),
    ]


def test_a_denylisted_word_inside_a_longer_word_is_not_flagged() -> None:
    source = 'a = "ventas"\nb = "clientele"\nc = "nuevamente"\n'
    assert spanish_literals(source, FIXTURE_DENYLIST) == []


def test_comments_identifiers_and_docstrings_are_not_read_but_fstrings_are() -> None:
    source = (
        "# la venta nueva\n"
        "venta = 1\n"
        "def cliente() -> None:\n"
        '    """Una venta."""\n'
        'x = f"nueva {venta} cliente"\n'
    )
    assert spanish_literals(source, FIXTURE_DENYLIST) == [
        (5, " cliente"),
        (5, "nueva "),
    ]


def test_the_denylist_drops_shared_words_and_short_words(tmp_path: Path) -> None:
    fixture = tmp_path / "list.json"
    fixture.write_text(
        json.dumps(
            {
                "min_word_length": 3,
                "denylist": ["de", "venta", "total"],
                "shared_words": {"total": "English too"},
            }
        )
    )
    assert load_denylist(fixture) == frozenset({"venta"})


def test_the_scan_counts_per_file_and_leaves_allowed_and_clean_files_out() -> None:
    root = REPO_ROOT / "tests" / "architecture" / "fixtures" / "spanish"
    counts = spanish_counts(
        root, FIXTURE_DENYLIST, ["tests/architecture/fixtures/spanish/allowed.py"]
    )
    assert counts == {
        "tests/architecture/fixtures/spanish/two_hits.py": 2,
        "tests/architecture/fixtures/spanish/one_hit.py": 1,
    }


def test_the_pending_rule_refuses_new_growing_and_stale_entries() -> None:
    counts = {"app/a.py": 2, "app/b.py": 3, "app/c.py": 1}
    pending = {"app/a.py": 2, "app/b.py": 2, "app/gone.py": 4}
    assert refusals(counts, pending) == [
        "app/b.py: 3 Spanish literal(s), above the 2 allowed",
        "app/c.py: 1 Spanish literal(s), not pending",
        "app/gone.py: no Spanish literal left, delete the entry",
    ]
    assert refusals({"app/a.py": 1}, {"app/a.py": 2}) == []


# --- the real tree -----------------------------------------------------------------------


def test_the_denylist_is_sorted_and_not_empty() -> None:
    words = json.loads(DENYLIST_FILE.read_text())["denylist"]
    assert words == sorted(words)
    assert len(words) > 100


def test_the_allowlist_names_a_real_file_each_with_a_reason() -> None:
    for pattern, reason in ALLOWLIST.items():
        assert reason.strip(), pattern
        assert any(
            fnmatchcase(p.relative_to(REPO_ROOT).as_posix(), pattern)
            for p in APP_ROOT.rglob("*")
            if p.is_file()
        ), pattern


def test_app_holds_no_spanish_literal_beyond_the_pending_files() -> None:
    counts = spanish_counts(APP_ROOT, load_denylist(), ALLOWLIST)
    assert refusals(counts, PENDING_SPANISH) == []
