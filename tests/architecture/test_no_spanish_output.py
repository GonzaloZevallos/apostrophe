"""No Spanish in what the operator's commands print (GH-53, ADR-0049): the output of the
accounts CLI, the business-removal CLI and the spreadsheet import's report holds no Spanish
character and no word of the frozen denylist (`tests/fixtures/spanish_copy.json`).

`test_no_spanish.py` reads the literals in the source; this reads what the commands really
print, so a text built at run time is seen too. What a command quotes stays as it was: the
import's report names the Spanish sheet's tabs, column titles and unfinished-row texts, and
the removal's prompt names the business, so those are read from the fixture itself (every
text in the workbook, every name the scenario seeded) and taken out before the scan. A
quoted text is allowed only because it is in the fixture, never from a list kept here.
"""

from __future__ import annotations

import io
import re
from collections.abc import Collection, Iterable
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.cli import main as accounts_main
from app.accounts.adapters.tables import BusinessRow
from app.business_removal.adapters.cli import main as removal_main
from app.spreadsheet_import.adapters.cli import run as import_run
from tests.architecture.test_no_spanish import SPANISH_CHARACTERS, WORD, load_denylist
from tests.business_removal.adapters.seed import EMAIL_LEAVING, PINNED, seed, set_env
from tests.conftest import NOW, MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    VARIETY,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)
from tests.spreadsheet_import.test_cli_pricing_settings import _workbook as _priced_workbook

BUSINESS_NAME = "La Huerta"  # the seller's own, seeded by the removal scenarios


def spanish_in(text: str, quoted: Iterable[str], denylist: Collection[str]) -> list[str]:
    """What is Spanish in `text` once every `quoted` text is taken out: a Spanish
    character, or a word (case aside) of `denylist`, longest quote first."""
    rest = text
    for quote in sorted({q for q in quoted if q}, key=len, reverse=True):
        # Only a whole quote: "Cliente" inside "Clientes" is the report's own word.
        rest = re.sub(rf"(?<!\w){re.escape(quote)}(?!\w)", " ", rest)
    found = SPANISH_CHARACTERS.findall(rest)
    found += [word for word in WORD.findall(rest) if word.lower() in denylist]
    return found


def workbook_texts(workbook: Workbook) -> set[str]:
    """Every text the sheet holds: its tab names and every text cell."""
    texts: set[str] = set()
    for sheet in workbook.worksheets:
        texts.add(sheet.title)
        for row in sheet.iter_rows():
            texts.update(cell.value for cell in row if isinstance(cell.value, str))
    return texts


DENYLIST = load_denylist()


# --- the scan itself, on text it must refuse and text it must accept ---------------------


def test_spanish_report_words_are_seen() -> None:
    assert spanish_in("Switches turned on: Precio por cantidad\n", (), DENYLIST)
    assert spanish_in("Guardá la venta", (), DENYLIST)
    assert spanish_in("Eliminar el negocio", (), DENYLIST)


def test_a_quoted_text_is_taken_out_and_the_words_around_it_are_still_read() -> None:
    quoted = ("Ventas",)
    assert spanish_in("Ventas row 2 [Total]: x", quoted, DENYLIST) == []
    assert spanish_in("Ventas row 2: guardá la venta", quoted, DENYLIST) != []


def test_a_quote_inside_a_longer_word_of_the_report_is_not_taken_out() -> None:
    assert spanish_in("Clientes: 3", ("Cliente",), DENYLIST) != []
    assert spanish_in("Cliente row 2", ("Cliente",), DENYLIST) == []


def test_a_text_with_a_spanish_character_is_seen_even_with_no_denylisted_word() -> None:
    assert spanish_in("Zorrá", (), DENYLIST) == ["á"]


def test_english_output_passes() -> None:
    assert spanish_in("Valid once, until 2026-10-21 09:00 UTC.", (), DENYLIST) == []


# --- the accounts CLI --------------------------------------------------------------------


def test_the_accounts_cli_prints_no_spanish(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path / 'apostrophe.db'}")
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://192.168.0.10:8000/")
    clock = MovableClock(NOW)

    codes = [
        accounts_main(["invite-business"], clock=clock),
        accounts_main(["reset-password", "nadie@example.com"], clock=clock),
        accounts_main(["reset-password", "not an email"], clock=clock),
    ]
    monkeypatch.delenv("APOSTROPHE_SECRET_KEY")
    codes.append(accounts_main(["invite-business"], clock=clock))

    captured = capsys.readouterr()
    assert codes == [0, 1, 1, 1]
    printed = captured.out + captured.err
    assert "Valid once, until" in printed
    assert "no user for that email" in printed
    assert "refused: " in printed
    assert spanish_in(printed, (), DENYLIST) == []


# --- the business-removal CLI ------------------------------------------------------------


def test_the_removal_cli_prints_no_spanish(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, tmp_path / "exports")
    printed: list[str] = []

    def run(argv: list[str], answer: str) -> int:
        stdout = io.StringIO()
        code = removal_main(argv, stdin=io.StringIO(answer), stdout=stdout, clock=clock)
        printed.append(stdout.getvalue())
        return code

    codes = [
        run(["nobody@example.com"], ""),
        run([EMAIL_LEAVING, "--dry-run"], ""),
        run([EMAIL_LEAVING], ""),
        run([EMAIL_LEAVING], "Not The Name\n"),
        run([EMAIL_LEAVING], f"{BUSINESS_NAME}\n"),
    ]

    assert codes == [1, 0, 1, 1, 0]
    text = "".join(printed)
    assert BUSINESS_NAME in text
    assert spanish_in(text, (BUSINESS_NAME,), DENYLIST) == []


# --- the import's report -----------------------------------------------------------------


def _unfinished_and_blocked() -> Workbook:
    """The Spanish-sheet fixture plus a sale left out as unfinished ("Falta pago") and a
    row naming a variety the sheet does not list, so the report prints every section."""
    workbook = _workbook()
    ventas = workbook["Ventas"]
    ventas.cell(row=3, column=1, value=date(2026, 1, 11))
    ventas.cell(row=3, column=2, value=VARIETY)
    ventas.cell(row=3, column=3, value=5)
    ventas.cell(row=3, column=5, value="Falta pago")
    ventas.cell(row=4, column=1, value=date(2026, 1, 12))
    ventas.cell(row=4, column=2, value="Variedad Desconocida")
    ventas.cell(row=4, column=3, value=5)
    ventas.cell(row=4, column=4, value="Efectivo")
    ventas.cell(row=4, column=5, value=5000)
    return workbook


def _threshold_and_price_refused() -> Workbook:
    """The Spanish-sheet fixture with a negative stock threshold and a bulk price above
    the list price, so the report prints a problem under each of those two columns."""
    workbook = _workbook(threshold=-1)
    ajustes = workbook["Ajustes"]
    ajustes.cell(row=37, column=4, value=1200)
    ajustes.cell(row=37, column=5, value=10)
    return workbook


def test_the_import_report_prints_no_spanish_beyond_what_the_sheet_wrote(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    workbooks = {
        "plain": _workbook(),
        "unfinished and blocked": _unfinished_and_blocked(),
        "threshold and price refused": _threshold_and_price_refused(),
        "both switches": _priced_workbook(bulk=True, kind="Amigo", grams=10, total=8000),
    }
    business_id = _business_id(engine)
    with Session(engine) as session:
        business_name = session.scalars(
            select(BusinessRow.name).where(BusinessRow.id == business_id)
        ).one()
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    reports: list[str] = []
    quoted: set[str] = {business_name}  # the seller's own name, printed on the first line
    for name, workbook in workbooks.items():
        quoted |= workbook_texts(workbook)
        out, err = io.StringIO(), io.StringIO()
        code = import_run(
            [
                str(business_id),
                str(_save_workbook(workbook, tmp_path, f"{name}.xlsx")),
                "--mapping",
                str(mapping),
                "--dry-run",
            ],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )
        assert code in (0, 1), err.getvalue()
        reports.append(out.getvalue() + err.getvalue())

    text = "".join(reports)
    assert "Left out as unfinished:" in text
    assert "Falta pago" in text
    assert "Blocking problems:" in text
    assert "stock.threshold_invalid" in text
    assert "variety.price_entry_invalid" in text
    assert "Switches turned on: Bulk pricing, VIP customers" in text
    assert spanish_in(text, quoted, DENYLIST) == []
