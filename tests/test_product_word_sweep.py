"""The permanent word sweep (GH-318, ADR-0070): no text a person reads says variety or
variedad, whatever the day or the order of the tests.

It scans resolved text, never source files: every message of every language's `.po`
(the languages come from the locale folders, minus the test locale `en-XA`), every line
the Operator's commands and the import report print (`run_operator_commands`), and the
Catalog rendered through `TestClient`. What the seller wrote passes through byte for
byte and is excluded by value. The listed exceptions are the quoted spreadsheet column
`[Variedad]` on an import problem line and the stored table name that heads a business
removal count line (`variety: 1`), which is data, not copy.
"""

import re
from collections.abc import Iterable
from dataclasses import replace
from io import StringIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.copy import operator_translator
from app.shared.copy.messages import po_messages
from app.shared.language import ENGLISH, TEST_LOCALE
from app.spreadsheet_import.adapters.report import print_report
from app.spreadsheet_import.domain.plan import ImportPlan
from app.spreadsheet_import.domain.rows import CellProblem, SheetRef
from tests.operator_copy.runs import _full_plan, run_operator_commands

LOCALES = Path(__file__).resolve().parents[1] / "app" / "shared" / "copy" / "locales"
WORD = re.compile(r"(?i)variet|variedad")
QUOTED_COLUMN = "[Variedad]"
STORED_TABLE_NAME = re.compile(r"^variety(?=: )")
SELLER_WORD = "Variety Haze"


def offences(texts: Iterable[str], *, exempt: Iterable[re.Pattern[str] | str] = ()) -> list[str]:
    """The texts that still say the word once the listed exceptions go."""
    found: list[str] = []
    for text in texts:
        rest = text
        for exception in exempt:
            rest = (
                exception.sub("", rest)
                if isinstance(exception, re.Pattern)
                else rest.replace(exception, "")
            )
        if WORD.search(rest):
            found.append(text)
    return found


def _languages() -> list[str]:
    return sorted(
        folder.name
        for folder in LOCALES.iterdir()
        if folder.is_dir() and folder.name != TEST_LOCALE.tag
    )


def _values(value: str | tuple[str, ...]) -> tuple[str, ...]:
    return (value,) if isinstance(value, str) else value


def test_the_sweep_flags_the_word_and_passes_only_the_listed_exceptions() -> None:
    texts = [
        "  Varieties: 3",
        "  Ventas row 4 [Variedad]: import.unknown_product",
        "a variety was saved",
        "variety: 1",
        "Products: 3",
    ]

    assert offences(texts) == texts[:4]
    assert offences(texts, exempt=[QUOTED_COLUMN, STORED_TABLE_NAME]) == [texts[0], texts[2]]


def test_the_languages_are_the_locale_folders_minus_the_test_locale() -> None:
    assert "en" in _languages()
    assert TEST_LOCALE.tag not in _languages()


@pytest.mark.parametrize("language", _languages())
def test_no_message_of_a_language_says_variety_or_variedad(language: str) -> None:
    po = LOCALES / language / "LC_MESSAGES" / "apostrophe.po"
    messages = po_messages(po)

    texts = [form for value in messages.values() for form in _values(value)]

    assert texts
    assert offences(texts) == []


def test_no_line_the_operator_prints_says_variety_or_variedad(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    capture = run_operator_commands(tmp_path, monkeypatch)

    lines = [line.text for line in capture.lines]

    assert len(lines) > 100
    assert offences(lines, exempt=[STORED_TABLE_NAME]) == []


def test_the_import_report_keeps_the_quoted_column_and_says_product_for_the_kind() -> None:
    plan: ImportPlan = replace(
        _full_plan(bulk=False, vip=False),
        problems=(
            CellProblem(SheetRef("Ventas", 4), "Variedad", "import.unknown_product"),
            CellProblem(SheetRef("Ventas", 5), "Variedad", "import.duplicate_product"),
        ),
    )
    out = StringIO()

    text = operator_translator(locales_dir=LOCALES, operator_language=ENGLISH, forced_language=None)
    print_report(plan, business_name="Negocio", dry_run=True, out=out, text=text)
    lines = out.getvalue().splitlines()

    problem_lines = [line for line in lines if "[Variedad]" in line]
    assert problem_lines == [
        "  Ventas row 4 [Variedad]: import.unknown_product",
        "  Ventas row 5 [Variedad]: import.duplicate_product",
    ]
    assert offences(lines) != []
    assert offences(lines, exempt=[QUOTED_COLUMN]) == []


def test_the_rendered_catalog_says_product_and_hands_the_sellers_words_back_byte_for_byte(
    client: TestClient,
) -> None:
    header, footer = f"{SELLER_WORD} — header", f"{SELLER_WORD}, footer"
    client.put("/catalog/header-footer", json={"header": header, "footer": footer})
    product = client.post("/api/products", json={"name": SELLER_WORD}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"product_id": product["id"], "origin": "opening_stock", "quantity": "50"},
    )

    body = client.get("/catalog").json()

    assert body["header"] == header
    assert body["footer"] == footer
    assert body["products"][0]["name"] == SELLER_WORD
    assert body["text"] is not None
    assert header in body["text"] and footer in body["text"]
    assert SELLER_WORD in body["text"]
    assert offences([body["text"]], exempt=[SELLER_WORD]) == []
    assert offences([body["text"]]) != []  # the sweep would flag it, were it not the seller's


def test_the_empty_and_the_default_catalog_say_nothing_of_variety(client: TestClient) -> None:
    client.post("/api/products", json={"name": "Plain"})

    body = client.get("/catalog").json()

    assert offences([body["header"], body["footer"]]) == []
