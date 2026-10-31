"""A quantity finer than the product's unit is refused where stock records it, and nothing
is written: entry create and edit, withdrawal create and edit, and the threshold, at 0, 1
and 2 decimals (invariants 4, 5 and 6)."""

from collections.abc import Collection
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.main import units_reader
from app.shared.quantity import Quantity, TooManyDecimals
from app.shared.unit import Unit
from app.spreadsheet_import.domain.rows import EntradaRow, SheetRef
from app.stock.adapters.import_port import SqlStockImport
from app.stock.adapters.tables import (
    StockEntryRow,
    StockThresholdRow,
    StockWithdrawalLineRow,
    StockWithdrawalRow,
)
from app.stock.application.ports import UnitsReader
from tests.fakes.units import set_unit_decimals

TOO_MANY = "quantity.too_many_decimals"
# decimals -> (a quantity the unit admits, one decimal too fine for it)
CASES = [(0, "3", "3.5"), (1, "3.5", "3.55"), (2, "3.55", "3.555")]


def _product(client: TestClient) -> int:
    return int(client.post("/api/products", json={"name": "Lavanda"}).json()["id"])


def _count(engine: Engine, row: type) -> int:
    with Session(engine) as session:
        return session.scalar(select(func.count()).select_from(row)) or 0


def _entry(product_id: int, quantity: str, **extra: Any) -> dict[str, Any]:
    return {"product_id": product_id, "origin": "opening_stock", "quantity": quantity} | extra


def _withdrawal(product_id: int, quantity: str, **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "reason": "promotion",
        "lines": [{"product_id": product_id, "quantity": quantity}],
    }
    return body | extra


@pytest.mark.parametrize(("decimals", "admitted", "too_fine"), CASES)
def test_an_entry_finer_than_the_unit_is_refused_on_create_and_on_edit(
    client: TestClient, engine: Engine, decimals: int, admitted: str, too_fine: str
) -> None:
    set_unit_decimals(engine, decimals)
    product_id = _product(client)

    refused = client.post("/stock/entries", json=_entry(product_id, too_fine))

    assert refused.status_code == 422
    assert refused.json()["code"] == TOO_MANY
    assert _count(engine, StockEntryRow) == 0
    created = client.post("/stock/entries", json=_entry(product_id, admitted))
    assert created.status_code == 201
    path = f"/stock/entries/{created.json()['id']}"

    edited = client.put(path, json=_entry(product_id, too_fine))

    assert edited.status_code == 422
    assert edited.json()["code"] == TOO_MANY
    assert client.get(path).json()["quantity"] == float(admitted)


@pytest.mark.parametrize(("decimals", "admitted", "too_fine"), CASES)
def test_a_withdrawal_finer_than_the_unit_is_refused_on_create_and_on_edit(
    client: TestClient, engine: Engine, decimals: int, admitted: str, too_fine: str
) -> None:
    set_unit_decimals(engine, decimals)
    product_id = _product(client)

    refused = client.post("/stock/withdrawals", json=_withdrawal(product_id, too_fine))

    assert refused.status_code == 422
    assert refused.json()["code"] == TOO_MANY
    assert (_count(engine, StockWithdrawalRow), _count(engine, StockWithdrawalLineRow)) == (0, 0)
    created = client.post("/stock/withdrawals", json=_withdrawal(product_id, admitted))
    assert created.status_code == 201
    path = f"/stock/withdrawals/{created.json()['id']}"

    edited = client.put(path, json=_withdrawal(product_id, too_fine))

    assert edited.status_code == 422
    assert edited.json()["code"] == TOO_MANY
    assert client.get(path).json()["lines"][0]["quantity"] == float(admitted)


@pytest.mark.parametrize(("decimals", "admitted", "too_fine"), CASES)
def test_a_threshold_finer_than_the_unit_is_refused_and_writes_nothing(
    client: TestClient, engine: Engine, decimals: int, admitted: str, too_fine: str
) -> None:
    set_unit_decimals(engine, decimals)
    product_id = _product(client)
    path = f"/stock/products/{product_id}/threshold"

    refused = client.put(path, json={"quantity": too_fine})

    assert refused.status_code == 422
    assert refused.json()["code"] == TOO_MANY
    assert _count(engine, StockThresholdRow) == 0
    assert client.put(path, json={"quantity": admitted}).status_code == 200
    assert _count(engine, StockThresholdRow) == 1


def test_one_finer_line_refuses_a_withdrawal_with_other_lines_that_fit(
    client: TestClient, engine: Engine
) -> None:
    set_unit_decimals(engine, 1)
    product_id = _product(client)
    body = _withdrawal(product_id, "1.5")
    body["lines"].append({"product_id": product_id, "quantity": "2.25"})

    refused = client.post("/stock/withdrawals", json=body)

    assert (refused.status_code, refused.json()["code"]) == (422, TOO_MANY)
    assert _count(engine, StockWithdrawalLineRow) == 0


def test_an_edit_of_the_date_never_refuses_a_finer_quantity_the_record_holds(
    client: TestClient, engine: Engine
) -> None:
    set_unit_decimals(engine, 2)
    product_id = _product(client)
    entry = client.post("/stock/entries", json=_entry(product_id, "3.55")).json()
    withdrawal = client.post("/stock/withdrawals", json=_withdrawal(product_id, "1.25")).json()
    set_unit_decimals(engine, 0)

    edited_entry = client.put(
        f"/stock/entries/{entry['id']}", json=_entry(product_id, "3.55", date="2026-09-01")
    )
    edited_withdrawal = client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json=_withdrawal(product_id, "1.25", date="2026-09-01"),
    )
    changed = client.put(
        f"/stock/entries/{entry['id']}", json=_entry(product_id, "3.56", date="2026-09-01")
    )

    assert (edited_entry.status_code, edited_withdrawal.status_code) == (200, 200)
    assert edited_entry.json()["date"] == "2026-09-01"
    assert (changed.status_code, changed.json()["code"]) == (422, TOO_MANY)


def test_an_edit_that_moves_an_entry_to_another_product_checks_its_unit(
    client: TestClient, engine: Engine
) -> None:
    set_unit_decimals(engine, 2)
    first, second = (
        _product(client),
        int(client.post("/api/products", json={"name": "Menta"}).json()["id"]),
    )
    entry = client.post("/stock/entries", json=_entry(first, "3.55")).json()
    with Session(engine) as session:
        session.execute(text("UPDATE unit SET decimals = 0"))
        session.commit()

    moved = client.put(f"/stock/entries/{entry['id']}", json=_entry(second, "3.55"))

    assert (moved.status_code, moved.json()["code"]) == (422, TOO_MANY)


def _lowering_after_the_first_read(app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Stands in for stock's units reader: right after the first read the unit loses its
    decimals, as a partner's change landing between the check and the write would. The
    returned list gets one item per rollback the request's session is asked for."""
    rollbacks: list[int] = []
    real = app.state.stock_units

    class Lowering:
        def __init__(self, session: Session, business_id: int) -> None:
            self._session = session
            self._reader: UnitsReader = real(session, business_id)
            self._reads = 0
            undo = session.rollback

            def counted() -> None:
                rollbacks.append(1)
                undo()

            monkeypatch.setattr(session, "rollback", counted)

        def units_of(self, product_ids: Collection[int]) -> dict[int, Unit]:
            found = self._reader.units_of(product_ids)
            self._reads += 1
            if self._reads == 1:
                self._session.execute(text("UPDATE unit SET decimals = 0"))
            return found

    app.state.stock_units = Lowering
    return rollbacks


def test_decimals_lost_after_the_first_read_undo_an_entry(
    app: FastAPI, client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_unit_decimals(engine, 2)
    product_id = _product(client)
    rollbacks = _lowering_after_the_first_read(app, monkeypatch)

    refused = client.post("/stock/entries", json=_entry(product_id, "1.5"))

    assert (refused.status_code, refused.json()["code"]) == (422, TOO_MANY)
    assert rollbacks == [1]
    assert _count(engine, StockEntryRow) == 0


def test_decimals_lost_after_the_first_read_undo_a_withdrawal(
    app: FastAPI, client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_unit_decimals(engine, 2)
    product_id = _product(client)
    rollbacks = _lowering_after_the_first_read(app, monkeypatch)

    refused = client.post("/stock/withdrawals", json=_withdrawal(product_id, "1.5"))

    assert (refused.status_code, refused.json()["code"]) == (422, TOO_MANY)
    assert rollbacks == [1]
    assert _count(engine, StockWithdrawalLineRow) == 0


def test_decimals_lost_after_the_first_read_undo_a_threshold(
    app: FastAPI, client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_unit_decimals(engine, 2)
    product_id = _product(client)
    rollbacks = _lowering_after_the_first_read(app, monkeypatch)

    refused = client.put(f"/stock/products/{product_id}/threshold", json={"quantity": "1.5"})

    assert (refused.status_code, refused.json()["code"]) == (422, TOO_MANY)
    assert rollbacks == [1]
    assert _count(engine, StockThresholdRow) == 0


def test_the_import_refuses_a_quantity_finer_than_the_unit_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    set_unit_decimals(engine, 0)
    product_id = _product(client)
    with Session(engine) as session:
        port = SqlStockImport(session, 1, units_reader(session, 1))
        with pytest.raises(TooManyDecimals):
            port.write_threshold(product_id, Quantity.of("1.5"), session)
        session.rollback()
    assert _count(engine, StockThresholdRow) == 0


def test_the_import_refuses_an_entry_finer_than_the_unit_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    set_unit_decimals(engine, 1)
    product_id = _product(client)
    row = EntradaRow(
        ref=SheetRef(sheet="Entradas", row=5),
        entry_date=date(2026, 10, 1),
        variety="Lavanda",
        quantity=Quantity.of("1.25"),
        origin="Stock inicial",
        total_cost=None,
        note=None,
        revisar=None,
    )
    with Session(engine) as session:
        port = SqlStockImport(session, 1, units_reader(session, 1))
        with pytest.raises(TooManyDecimals):
            port.write_entry(
                product_id, row, datetime(2026, 10, 2, tzinfo=UTC), date(2026, 10, 2), session
            )
        session.rollback()
    assert _count(engine, StockEntryRow) == 0
