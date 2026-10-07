"""`cli.run` and the pricing switches (docs/adr/0031): the import switches on what its
sheet needs, prices every row with it, never turns a switch off, and says in its report
which switches it turned on. Real `.xlsx` fixtures over the `conftest` engine and clock;
the switches and every price are read back through the HTTP API.
"""

from __future__ import annotations

import io
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pricing_settings.adapters.import_port import PricingSettingsImport
from app.pricing_settings.adapters.tables import PricingSettingsRow
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock
from tests.spreadsheet_import.test_cli import (
    ENTRADAS_TITLES,
    GASTOS_TITLES,
    VENTAS_TITLES,
    _titles,
)

VARIETY = "Jack Herer"
PHONE = "1123456789"


def _workbook(*, bulk: bool, kind: str, grams: int, total: int) -> Workbook:
    """One variety at $1000 (bulk $800 from 10 g when `bulk`), one sale of it."""
    workbook = Workbook()
    active = workbook.active
    assert active is not None
    workbook.remove(active)
    ajustes = workbook.create_sheet(layout.AJUSTES_SHEET)
    ajustes.cell(row=7, column=1, value=VARIETY)
    ajustes.cell(row=37, column=1, value=VARIETY)
    ajustes.cell(row=37, column=2, value=date(2026, 1, 1))
    ajustes.cell(row=37, column=3, value=1000)
    if bulk:
        ajustes.cell(row=37, column=4, value=800)
        ajustes.cell(row=37, column=5, value=10)
    workbook.create_sheet(layout.CATALOGO_SHEET)
    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    ventas.cell(row=2, column=1, value=date(2026, 1, 10))
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=grams)
    ventas.cell(row=2, column=4, value="Efectivo")
    ventas.cell(row=2, column=5, value=total)
    ventas.cell(row=2, column=6, value="Juan Perez")
    ventas.cell(row=2, column=7, value=kind)
    for name, titles in (
        (layout.ENTRADAS_SHEET, ENTRADAS_TITLES),
        (layout.GASTOS_SHEET, GASTOS_TITLES),
    ):
        _titles(workbook.create_sheet(name), titles)
    return workbook


def _business_id(engine: Engine) -> int:
    with Session(engine) as session:
        row = session.scalars(select(BusinessRow).where(BusinessRow.name == "Primer Negocio")).one()
        assert row.id is not None
        return row.id


def _import(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    workbook: Workbook,
    *,
    dry_run: bool = False,
) -> tuple[int, str]:
    xlsx = tmp_path / "sheet.xlsx"
    workbook.save(xlsx)
    mapping = tmp_path / "mapping.csv"
    mapping.write_text(f"name,phone\nJuan Perez,{PHONE}\n", encoding="utf-8")
    out, err = io.StringIO(), io.StringIO()
    argv = [str(_business_id(engine)), str(xlsx), "--mapping", str(mapping)]
    code = run(
        [*argv, "--dry-run"] if dry_run else argv, engine=engine, clock=clock, out=out, err=err
    )
    assert err.getvalue() == ""
    return code, out.getvalue()


def _switches(client: TestClient) -> tuple[bool, bool]:
    body = client.get("/pricing-settings").json()
    return body["is_bulk_pricing"], body["is_vip_customers"]


def _only_sale(client: TestClient) -> dict[str, object]:
    sales = client.get("/sales").json()
    assert len(sales) == 1
    sale: dict[str, object] = client.get(f"/sales/{sales[0]['id']}").json()
    return sale


def test_a_sheet_with_bulk_prices_and_an_amigo_row_turns_both_switches_on(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    sheet = _workbook(bulk=True, kind="Amigo", grams=10, total=8000)

    code, out = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert "Switches turned on: Precio por cantidad, Clientes VIP" in out
    assert _switches(client) == (True, True)
    price = client.get("/varieties").json()[0]["current_price"]
    assert (price["list_price"], price["bulk_price"], price["vip_price"]) == (1000, 800, 800)
    assert _only_sale(client)["total"] == 8000


def test_the_dry_run_reports_the_switches_and_changes_none(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    sheet = _workbook(bulk=True, kind="Amigo", grams=10, total=8000)

    code, out = _import(client, engine, clock, tmp_path, sheet, dry_run=True)

    assert code == 0
    assert "Switches turned on: Precio por cantidad, Clientes VIP" in out
    assert _switches(client) == (False, False)
    assert client.get("/varieties").json() == []


def test_a_sheet_with_neither_leaves_both_off_and_stores_no_vip_price(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    sheet = _workbook(bulk=False, kind="Lista", grams=10, total=10_000)

    code, out = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert "Switches turned on: none" in out
    assert _switches(client) == (False, False)
    assert client.get("/varieties").json()[0]["current_price"]["vip_price"] is None
    assert _only_sale(client)["total"] == 10_000


def test_bulk_prices_without_a_vip_customer_switch_only_bulk_on_and_store_no_vip_price(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    sheet = _workbook(bulk=True, kind="Lista", grams=10, total=8000)

    code, out = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert "Switches turned on: Precio por cantidad\n" in out
    assert _switches(client) == (True, False)
    price = client.get("/varieties").json()[0]["current_price"]
    assert (price["bulk_price"], price["vip_price"]) == (800, None)
    assert _only_sale(client)["total"] == 8000


def test_a_switch_already_on_stays_on_and_is_not_reported(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": False})
    sheet = _workbook(bulk=True, kind="Amigo", grams=10, total=8000)

    code, out = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert "Switches turned on: Clientes VIP\n" in out
    assert _switches(client) == (True, True)


def test_a_switch_already_on_is_never_turned_off_by_a_sheet_that_needs_nothing(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True})
    sheet = _workbook(bulk=False, kind="Lista", grams=10, total=10_000)

    code, out = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert "Switches turned on: none" in out
    assert _switches(client) == (True, True)


def test_an_amigo_row_without_a_vip_price_pays_list_when_the_variety_has_no_bulk_price(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    sheet = _workbook(bulk=False, kind="Amigo", grams=10, total=10_000)

    code, _ = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert _switches(client) == (False, True)
    assert _only_sale(client)["total"] == 10_000


def test_a_lista_row_at_the_bulk_minimum_takes_the_bulk_price_with_the_switches_off_before(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    sheet = _workbook(bulk=True, kind="Lista", grams=20, total=16_000)

    code, _ = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert _only_sale(client)["total"] == 16_000


def test_a_switch_turned_on_between_the_plan_and_the_write_still_succeeds_with_the_plans_prices(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A second writer switches Precio por cantidad on after the plan read the stored
    switches (both off) and right before the write's own `switch_on`: the run is no
    refusal, the switches end as stored OR needed, and the sale keeps the planned total."""
    business_id = _business_id(engine)
    original = PricingSettingsImport.switch_on

    def _racing_switch_on(self: PricingSettingsImport, bulk: bool, vip: bool) -> None:
        with Session(engine) as racer:
            racer.execute(
                update(PricingSettingsRow)
                .where(PricingSettingsRow.business_id == business_id)
                .values(is_bulk_pricing=True)
            )
            racer.commit()
        original(self, bulk, vip)

    monkeypatch.setattr(PricingSettingsImport, "switch_on", _racing_switch_on)
    sheet = _workbook(bulk=True, kind="Amigo", grams=10, total=8000)

    code, out = _import(client, engine, clock, tmp_path, sheet)

    assert code == 0
    assert "Switches turned on: Precio por cantidad, Clientes VIP" in out
    assert _switches(client) == (True, True)
    sale = _only_sale(client)
    assert sale["total"] == 8000
    lines = sale["lines"]
    assert isinstance(lines, list)
    assert lines[0]["pricing_rule"] == "vip"
