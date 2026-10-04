"""`SqlStockImport` (`app/stock/adapters/import_port.py`), the spreadsheet import's
only way into stock's tables (CODING_STANDARDS section 5; the plan's invariant).

`client` opens the first (and, in these tests, only) business on a fresh engine, so its
id is always 1 (as `tests/catalog/test_sql_attributes.py` already relies on).
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.shared.grams import Grams
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.domain.rows import EntradaRow, SheetRef
from app.stock.adapters.import_port import SqlStockImport

BUSINESS_ID = 1
TODAY = date(2026, 10, 2)
REF = SheetRef(sheet="Entradas", row=5)
TEN_GRAMS = Grams.of("10")


def _variety_id(client: TestClient, name: str = "Zkittlez") -> int:
    return int(client.post("/varieties", json={"name": name}).json()["id"])


def _row(
    *,
    entry_date: date | None = TODAY,
    variety: str | None = "Zkittlez",
    grams: Grams | None = TEN_GRAMS,
    origin: str | None = "Compra",
    total_cost: int | None = 10_000,
    note: str | None = None,
) -> EntradaRow:
    return EntradaRow(
        ref=REF,
        entry_date=entry_date,
        variety=variety,
        grams=grams,
        origin=origin,
        total_cost=total_cost,
        note=note,
        revisar=None,
    )


# -- check_threshold ---------------------------------------------------------------


def test_check_threshold_accepts_a_positive_threshold(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        assert port.check_threshold(Grams.of("5")) is None


def test_check_threshold_refuses_a_zero_threshold(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_threshold(Grams.of("0"))
        assert refusal is not None
        assert refusal.code == "stock.threshold_invalid"


# -- check_entry: one case per Entradas Revisar text -------------------------------


def test_revisar_falta_fecha_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(entry_date=None), TODAY)
        assert refusal is not None
        assert refusal.code == "import.field_missing"


def test_revisar_falta_variedad_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(variety=None), TODAY)
        assert refusal is not None
        assert refusal.code == "import.field_missing"


def test_revisar_faltan_gramos_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(grams=None), TODAY)
        assert refusal is not None
        assert refusal.code == "import.field_missing"


def test_revisar_falta_origen_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(origin=None), TODAY)
        assert refusal is not None
        assert refusal.code == "import.field_missing"


def test_revisar_gramos_negativos_blocks(engine: Engine, client: TestClient) -> None:
    """Negative grams outside an adjustment ("Gramos negativos")."""
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(
            _row(origin="Compra", grams=Grams.of("-5"), total_cost=None), TODAY
        )
        assert refusal is not None
        assert refusal.code == "stock.grams_invalid"


def test_revisar_falta_costo_blocks(engine: Engine, client: TestClient) -> None:
    """A purchase with no cost ("Falta costo")."""
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(origin="Compra", total_cost=None), TODAY)
        assert refusal is not None
        assert refusal.code == "stock.cost_required"


# -- check_entry: an unknown origin, and every other owner refusal -----------------


def test_an_unknown_origin_blocks_with_the_import_s_own_code(
    engine: Engine, client: TestClient
) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(origin="Rareza"), TODAY)
        assert refusal is not None
        assert refusal.code == "import.origin_unknown"


def test_a_future_date_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(entry_date=date(2026, 10, 3)), TODAY)
        assert refusal is not None
        assert refusal.code == "stock.date_in_future"


def test_a_non_positive_cost_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(
            _row(origin="Cosecha", grams=Grams.of("5"), total_cost=-5), TODAY
        )
        assert refusal is not None
        assert refusal.code == "stock.cost_invalid"


def test_a_cost_on_a_negative_adjustment_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(
            _row(origin="Ajuste", grams=Grams.of("-5"), total_cost=100), TODAY
        )
        assert refusal is not None
        assert refusal.code == "stock.cost_on_negative_adjustment"


def test_a_too_long_note_blocks(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        refusal = port.check_entry(_row(note="x" * 201), TODAY)
        assert refusal is not None
        assert refusal.code == "stock.note_too_long"


def test_a_finished_row_passes(engine: Engine, client: TestClient) -> None:
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        assert port.check_entry(_row(), TODAY) is None


# -- has_records ---------------------------------------------------------------------


def test_has_records_is_false_with_only_a_threshold(engine: Engine, client: TestClient) -> None:
    variety_id = _variety_id(client)
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        port.write_threshold(variety_id, Grams.of("5"), NoCommit())
        session.commit()
        assert port.has_records() is False


def test_has_records_is_true_after_one_entry(engine: Engine, client: TestClient) -> None:
    variety_id = _variety_id(client)
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        port.write_entry(
            variety_id,
            _row(),
            datetime(2026, 10, 2, 12, 0, tzinfo=UTC),
            TODAY,
            NoCommit(),
        )
        session.commit()
        assert port.has_records() is True


# -- write_entry refuses an unchecked row, rather than writing it --------------------


@pytest.mark.parametrize(
    "unchecked_row",
    [_row(entry_date=None), _row(grams=None), _row(origin=None)],
    ids=["no_date", "no_grams", "no_origin"],
)
def test_write_entry_rejects_a_row_that_was_never_checked(
    engine: Engine, client: TestClient, unchecked_row: EntradaRow
) -> None:
    """`write_entry` takes a row `check_entry` already passed. A row still missing its
    date, grams or origin never reached that check, so `write_entry` must reject it
    outright rather than silently write around the gap."""
    variety_id = _variety_id(client)
    with Session(engine) as session:
        port = SqlStockImport(session, BUSINESS_ID)
        with pytest.raises(AssertionError):
            port.write_entry(
                variety_id,
                unchecked_row,
                datetime(2026, 10, 2, 12, 0, tzinfo=UTC),
                TODAY,
                NoCommit(),
            )
        session.commit()
        assert port.has_records() is False
