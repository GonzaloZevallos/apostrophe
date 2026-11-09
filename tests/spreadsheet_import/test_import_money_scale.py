"""The Spreadsheet import writes amounts through the same adapters as the routes
(docs/adr/0058): the one workbook imported into a business that stores whole units and into
one that stores hundredths reads back the same amounts through the API. Driven through
`cli.run`; the suite's `SCALES` stays `(0,)` until the flip, so this module asks for both
scales itself."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.shared.copy import OperatorText
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    SALE_TOTAL,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)


@pytest.fixture(params=(0, 2))
def money_scale(request: pytest.FixtureRequest) -> int:
    scale: int = request.param
    return scale


def _import(
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
    workbook: Workbook,
) -> tuple[int, str]:
    business_id = _business_id(engine)
    xlsx = _save_workbook(workbook, tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    err = io.StringIO()
    code = run(
        [str(business_id), str(xlsx), "--mapping", str(mapping)],
        engine=engine,
        clock=clock,
        out=io.StringIO(),
        err=err,
        text=operator_text_en,
    )
    return code, err.getvalue()


def _stored_scale(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text("SELECT scale FROM money_format")).scalar_one())


def test_an_import_gives_the_same_amounts_through_the_api_at_either_scale(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
    money_scale: int,
) -> None:
    code, err = _import(engine, clock, tmp_path, operator_text_en, _workbook())

    assert code == 0, err
    assert _stored_scale(engine) == money_scale
    products: list[dict[str, Any]] = client.get("/api/products").json()
    assert products[0]["current_price"]["list_price"] == 1_000
    assert client.get("/stock/entries/1").json()["total_cost"] == 20_000
    month: dict[str, Any] = client.get("/expenses", params={"month": "2026-01"}).json()
    assert month["total"] == 500
    assert [e["amount"] for c in month["categories"] for e in c["expenses"]] == [500]
    customers: list[dict[str, Any]] = client.get("/customers").json()
    assert customers[0]["balance"] == SALE_TOTAL
    with engine.connect() as connection:
        stored = connection.execute(text("SELECT amount FROM expense")).scalar_one()
    assert stored == 500 * 10**money_scale


def test_a_sheet_amount_with_a_fraction_is_refused_and_nothing_is_written(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
    money_scale: int,
) -> None:
    workbook = _workbook()
    workbook[layout.GASTOS_SHEET].cell(row=2, column=3, value=500.5)

    code, _err = _import(engine, clock, tmp_path, operator_text_en, workbook)

    assert code == 1
    assert client.get("/api/products").json() == []
    assert client.get("/expenses", params={"month": "2026-01"}).json()["total"] == 0
