"""`cli.run` end to end (CODING_STANDARDS.md section 5): a real `.xlsx` fixture and a
real mapping file, run over the `conftest` engine and movable clock, with the business
opened through the `client` fixture and every figure read back through the HTTP API.
Never by building rows by hand (the plan's seam for this subtask).
"""

from __future__ import annotations

import io
import logging
import re
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.customers.adapters.import_port import CustomersImport
from app.customers.adapters.tables import CustomerRow
from app.migrations.runner import upgrade_to_head
from app.sales.adapters.import_port import SalesImport
from app.shared.transaction import Transaction
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock, open_business, signed_in

# No report line, exception message or log line ever carries a phone number, not even
# a run of 4 or more of its digits (the plan's invariant).
_DIGIT_RUN = re.compile(r"\d{4,}")

VENTAS_TITLES = (
    "Fecha",
    "Variedad",
    "Gramos",
    "Pago",
    "Total",
    "Cliente",
    "Tipo",
    "Envío cobrado",
    "Precio especial (total)",
    "Nota",
)
ENTRADAS_TITLES = ("Fecha", "Variedad", "Gramos", "Origen", "Costo total", "Nota", "Revisar")
GASTOS_TITLES = ("Fecha", "Categoría", "Monto", "Detalle", "Revisar")

VARIETY = "Jack Herer"
CUSTOMER = "Juan Perez"
PHONE = "1123456789"
SALE_TOTAL = 10_000


def _titles(ws: Worksheet, titles: tuple[str, ...]) -> None:
    for index, title in enumerate(titles, start=1):
        ws.cell(row=layout.TITLE_ROW, column=index, value=title)


def _workbook(
    *,
    sale_date: date = date(2026, 1, 10),
    payment: str = "Pendiente",
    threshold: float | None = 5,
) -> Workbook:
    workbook = Workbook()
    active = workbook.active
    assert active is not None
    workbook.remove(active)

    ajustes = workbook.create_sheet(layout.AJUSTES_SHEET)
    ajustes.cell(row=7, column=1, value=VARIETY)
    if threshold is not None:
        ajustes.cell(row=7, column=6, value=threshold)
    ajustes.cell(row=21, column=1, value="Insumos")
    ajustes.cell(row=37, column=1, value=VARIETY)
    ajustes.cell(row=37, column=2, value=date(2026, 1, 1))
    ajustes.cell(row=37, column=3, value=1000)

    catalogo = workbook.create_sheet(layout.CATALOGO_SHEET)
    catalogo.cell(row=6, column=1, value=VARIETY)
    catalogo.cell(row=6, column=2, value="Sí")
    catalogo.cell(row=18, column=2, value="Catálogo de la casa")
    catalogo.cell(row=19, column=2, value="Gracias por su compra")

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    ventas.cell(row=2, column=1, value=sale_date)
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=10)
    ventas.cell(row=2, column=4, value=payment)
    ventas.cell(row=2, column=5, value=SALE_TOTAL)
    ventas.cell(row=2, column=6, value=CUSTOMER)
    ventas.cell(row=2, column=7, value="")

    entradas = workbook.create_sheet(layout.ENTRADAS_SHEET)
    _titles(entradas, ENTRADAS_TITLES)
    entradas.cell(row=2, column=1, value=date(2026, 1, 1))
    entradas.cell(row=2, column=2, value=VARIETY)
    entradas.cell(row=2, column=3, value=50)
    entradas.cell(row=2, column=4, value="Compra")
    entradas.cell(row=2, column=5, value=20_000)

    gastos = workbook.create_sheet(layout.GASTOS_SHEET)
    _titles(gastos, GASTOS_TITLES)
    gastos.cell(row=2, column=1, value=date(2026, 1, 2))
    gastos.cell(row=2, column=2, value="Insumos")
    gastos.cell(row=2, column=3, value=500)
    gastos.cell(row=2, column=4, value="Bolsas")

    return workbook


def _save_workbook(workbook: Workbook, tmp_path: Path, name: str = "sheet.xlsx") -> Path:
    path = tmp_path / name
    workbook.save(path)
    return path


def _save_mapping(
    tmp_path: Path, rows: tuple[tuple[str, str], ...], name: str = "mapping.csv"
) -> Path:
    path = tmp_path / name
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("name,phone\n")
        for row_name, phone in rows:
            handle.write(f"{row_name},{phone}\n")
    return path


def _business_id(engine: Engine, name: str = "Primer Negocio") -> int:
    with Session(engine) as session:
        row = session.scalars(select(BusinessRow).where(BusinessRow.name == name)).one()
        assert row.id is not None
        return row.id


def test_dry_run_writes_nothing_and_reports_the_counts(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping), "--dry-run"],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
    )

    assert code == 0
    assert err.getvalue() == ""
    assert "Sales: 1" in out.getvalue()
    assert "Writable: yes" in out.getvalue()
    assert client.get("/varieties").json() == []
    assert client.get("/customers").json() == []
    assert client.get("/stock").json()["varieties"] == []


def test_real_run_imports_and_the_figures_match(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    with caplog.at_level(logging.DEBUG):
        code = run(
            [str(business_id), str(xlsx), str(mapping)],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )

    assert code == 0, err.getvalue()
    assert err.getvalue() == ""
    assert caplog.records == []
    assert PHONE not in out.getvalue()
    assert not _DIGIT_RUN.search(out.getvalue())

    varieties = client.get("/varieties").json()
    assert len(varieties) == 1
    assert varieties[0]["name"] == VARIETY
    assert varieties[0]["current_price"]["list_price"] == 1000

    catalog = client.get("/catalog").json()
    assert catalog["header"] == "Catálogo de la casa"
    assert catalog["footer"] == "Gracias por su compra"

    stock = client.get("/stock").json()
    assert len(stock["varieties"]) == 1
    # 50 g bought in, 10 g sold: 40 g left.
    assert stock["varieties"][0]["grams"] == 40.0
    assert stock["varieties"][0]["threshold"] == 5.0

    customers = client.get("/customers").json()
    assert len(customers) == 1
    assert customers[0]["name"] == CUSTOMER
    assert customers[0]["balance"] == SALE_TOTAL
    assert customers[0]["owing_since"] == "2026-01-10"


def test_an_unknown_business_is_refused_with_no_echo(
    engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    upgrade_to_head(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(["999999", str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err)

    assert code == 1
    assert err.getvalue() == "refused: import.business_unknown\n"
    assert out.getvalue() == ""


def test_a_business_with_records_is_refused_with_nothing_written(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    client.post("/varieties", json={"name": "Existente"})
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 1
    assert err.getvalue() == ""
    assert "import.business_has_records" in out.getvalue()
    varieties = client.get("/varieties").json()
    assert [v["name"] for v in varieties] == ["Existente"]


def test_imported_records_are_invisible_from_another_business(
    client: TestClient,
    other_client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 0, err.getvalue()
    assert other_client.get("/varieties").json() == []
    assert other_client.get("/customers").json() == []
    assert other_client.get("/stock").json()["varieties"] == []


def test_a_malformed_mapping_on_a_real_run_is_refused_with_no_echo(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping_path = tmp_path / "mapping.csv"
    # A header that doesn't match at all: every entry is unreachable, so the
    # problem is located by line number alone, never by content.
    mapping_path.write_text(f"nombre,telefono\n{CUSTOMER},{PHONE}\n", encoding="utf-8")
    out, err = io.StringIO(), io.StringIO()

    with caplog.at_level(logging.DEBUG):
        code = run(
            [str(business_id), str(xlsx), str(mapping_path)],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )

    assert code == 1
    report = out.getvalue()
    assert PHONE not in report
    assert CUSTOMER not in report
    assert not _DIGIT_RUN.search(report)
    assert not _DIGIT_RUN.search(err.getvalue())
    assert caplog.records == []
    assert client.get("/customers").json() == []


def test_the_last_writer_forced_to_raise_leaves_nothing_written(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Ventas is the last kind written (varieties -> ... -> Entradas -> Gastos ->
    # Ventas): forcing the real `SalesImport.write_sale` port method to raise proves
    # everything staged before it (varieties, stock, catalog, categories, customers)
    # is rolled back too, not just skipped from this point on.
    def _boom(*_args: Any, **_kwargs: Any) -> int:
        raise RuntimeError(f"forced failure, phone {PHONE}")

    monkeypatch.setattr(SalesImport, "write_sale", _boom)

    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 1
    assert err.getvalue() == "refused: RuntimeError\n"
    assert PHONE not in out.getvalue()
    assert PHONE not in err.getvalue()
    assert not _DIGIT_RUN.search(out.getvalue())
    assert not _DIGIT_RUN.search(err.getvalue())
    assert client.get("/varieties").json() == []
    assert client.get("/customers").json() == []
    assert client.get("/stock").json()["varieties"] == []
    # Only the 4 seeded categories remain: the fixture's own "Insumos" never landed.
    assert len(client.get("/expense-categories").json()) == 4
    assert client.get("/catalog").json()["header"] != "Catálogo de la casa"


def test_a_dry_run_and_a_refused_real_run_over_a_blocking_fixture_write_nothing(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    # An unknown Entradas origin blocks the whole plan; nothing else about the
    # fixture is invalid, so every other row would otherwise be written fine.
    workbook = _workbook()
    workbook[layout.ENTRADAS_SHEET].cell(row=2, column=4, value="Robo")
    xlsx = _save_workbook(workbook, tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    business_id = _business_id(engine)

    for argv_tail in (["--dry-run"], []):
        out, err = io.StringIO(), io.StringIO()
        code = run(
            [str(business_id), str(xlsx), str(mapping), *argv_tail],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )
        assert code in (0, 1)
        assert err.getvalue() == ""
        assert "Writable: no" in out.getvalue()
        assert "import.origin_unknown" in out.getvalue()
        assert client.get("/varieties").json() == []
        assert client.get("/customers").json() == []
        assert client.get("/stock").json()["varieties"] == []
        assert client.get("/catalog").json()["header"] != "Catálogo de la casa"


def test_a_real_duplicate_phone_is_refused_by_its_own_clean_code(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A second writer lands a customer with the same phone number into this business
    *during* the write — the known, accepted race of concurrent writes (ADR-0014's
    "Known risks") — rather than before it starts, which eligibility would simply
    refuse up front instead. The real `CustomersImport.write_customer` is made to
    insert that racing row, through a second session, right before it does its own
    real work. The collision is real: SQLite's own unique constraint on
    `(business_id, phone)` fires on flush, and `SqlCustomers`
    (app/customers/adapters/sql_customers.py) always turns that `IntegrityError` into
    the clean `PhoneTaken` before it leaves the adapter, so what reaches `cli.run`
    already carries only a fixed code, never the driver's own message — which, with a
    real phone number bound, is exactly what `hide_parameters=True` on `make_engine`
    would have kept out of a log line too, had this been logged."""
    business_id = _business_id(engine)
    original = CustomersImport.write_customer
    raced = False

    def _racing_write_customer(
        self: CustomersImport, name: str, phone_key: str, vip: bool, transaction: Transaction
    ) -> int:
        nonlocal raced
        if not raced:
            raced = True
            with Session(engine) as racer:
                racer.add(CustomerRow(business_id=business_id, name="Otro", phone=phone_key))
                racer.commit()
        return original(self, name, phone_key, vip, transaction)

    monkeypatch.setattr(CustomersImport, "write_customer", _racing_write_customer)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 1
    assert err.getvalue() == "refused: customer.phone_taken\n"
    assert PHONE not in out.getvalue()
    assert CUSTOMER not in out.getvalue()
    assert not _DIGIT_RUN.search(out.getvalue())
    assert not _DIGIT_RUN.search(err.getvalue())


def _seed_variety(seed_client: TestClient) -> int:
    body = seed_client.post("/varieties", json={"name": "Existente"})
    assert body.status_code == 201, body.text
    return int(body.json()["id"])


def _seed_variety_with_price(seed_client: TestClient) -> None:
    variety_id = _seed_variety(seed_client)
    body = seed_client.post(
        f"/varieties/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 1000},
    )
    assert body.status_code == 201, body.text


def _seed_stock_entry(seed_client: TestClient) -> None:
    variety_id = _seed_variety(seed_client)
    body = seed_client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "purchase", "grams": 5, "total_cost": 500},
    )
    assert body.status_code == 201, body.text


def _seed_customer(seed_client: TestClient) -> None:
    body = seed_client.post(
        "/customers", json={"name": "Existente", "phone": "+5491199999999", "vip": False}
    )
    assert body.status_code == 201, body.text


def _seed_sale(seed_client: TestClient) -> None:
    variety_id = _seed_variety(seed_client)
    body = seed_client.post(
        "/sales",
        json={
            "date": "2026-01-01",
            "lines": [{"variety_id": variety_id, "grams": 1, "gift": True}],
        },
    )
    assert body.status_code == 201, body.text


def _seed_payment(seed_client: TestClient) -> None:
    customer_body = seed_client.post(
        "/customers", json={"name": "Existente", "phone": "+5491199999998", "vip": False}
    )
    customer_id = customer_body.json()["id"]
    variety_id = _seed_variety(seed_client)
    sale_body = seed_client.post(
        "/sales",
        json={
            "date": "2026-01-01",
            "customer_id": customer_id,
            "lines": [{"variety_id": variety_id, "grams": 1, "special_price": 1000}],
            "payment": "owing",
        },
    )
    assert sale_body.status_code == 201, sale_body.text
    payment_body = seed_client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-01-01", "amount": 1000, "method": "cash"},
    )
    assert payment_body.status_code == 201, payment_body.text


def _seed_expense(seed_client: TestClient) -> None:
    category_body = seed_client.post("/expense-categories", json={"name": "Varios"})
    category_id = category_body.json()["id"]
    body = seed_client.post(
        "/expenses",
        json={
            "spent_on": "2026-01-01",
            "category_id": category_id,
            "amount": 100,
            "detail": "algo",
        },
    )
    assert body.status_code == 201, body.text


# Price entry is not independently seedable: a price entry can never outlive its
# variety (a foreign key), so varieties.has_records() already covers both at once;
# `_seed_variety_with_price` seeds them together rather than pretending they split.
_ELIGIBILITY_SEEDS = (
    _seed_variety,
    _seed_variety_with_price,
    _seed_stock_entry,
    _seed_customer,
    _seed_sale,
    _seed_payment,
    _seed_expense,
)


def test_eligibility_refuses_each_of_the_seven_kinds(
    app: FastAPI, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    for index, seed in enumerate(_ELIGIBILITY_SEEDS):
        name = f"Negocio {index}"
        with TestClient(app) as seed_client:
            token = open_business(seed_client, engine, clock, name, f"u{index}@example.com")
            signed_in(seed_client, token)
            seed(seed_client)

        business_id = _business_id(engine, name=name)
        xlsx = _save_workbook(_workbook(), tmp_path)
        mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),), name=f"mapping-{index}.csv")
        out, err = io.StringIO(), io.StringIO()

        code = run(
            [str(business_id), str(xlsx), str(mapping)],
            engine=engine,
            clock=clock,
            out=out,
            err=err,
        )

        assert code == 1, f"{seed.__name__}: {out.getvalue()}"
        assert "import.business_has_records" in out.getvalue()


def test_a_business_with_only_renamed_or_removed_seeded_categories_is_accepted(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    categories = client.get("/expense-categories").json()
    by_name = {c["name"]: c["id"] for c in categories}
    client.patch(f"/expense-categories/{by_name['Otros']}", json={"name": "Varios"})
    client.delete(f"/expense-categories/{by_name['Packaging']}")

    business_id = _business_id(engine)
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )

    assert code == 0, err.getvalue()
    assert len(client.get("/varieties").json()) == 1


def test_recording_order_follows_date_then_sheet_row(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    """Both Entradas and Ventas list a later date above an earlier one in the sheet:
    only sorting by date first, never by sheet order, gets the lots and the account
    right. A negative `Ajuste`, dated the same day as the earlier sale, is recorded
    before every sale (ADR-0009's lot order ranks a stock entry ahead of a sale line on
    a tied day) and is sized to drain enough of the cheaper lot that the earlier sale
    spans both lots — a line cost that would come out differently had sheet order,
    rather than date, decided what got recorded first."""
    workbook = Workbook()
    active = workbook.active
    assert active is not None
    workbook.remove(active)

    ajustes = workbook.create_sheet(layout.AJUSTES_SHEET)
    ajustes.cell(row=7, column=1, value=VARIETY)
    ajustes.cell(row=37, column=1, value=VARIETY)
    ajustes.cell(row=37, column=2, value=date(2026, 1, 1))
    ajustes.cell(row=37, column=3, value=1000)

    workbook.create_sheet(layout.CATALOGO_SHEET)

    entradas = workbook.create_sheet(layout.ENTRADAS_SHEET)
    _titles(entradas, ENTRADAS_TITLES)
    # Row 2: the LATER-dated, costlier lot, listed FIRST in the sheet.
    entradas.cell(row=2, column=1, value=date(2026, 1, 10))
    entradas.cell(row=2, column=2, value=VARIETY)
    entradas.cell(row=2, column=3, value=10)
    entradas.cell(row=2, column=4, value="Compra")
    entradas.cell(row=2, column=5, value=1000)  # 100/g
    # Row 3: the EARLIER-dated, cheaper lot, listed SECOND — date must still win.
    entradas.cell(row=3, column=1, value=date(2026, 1, 1))
    entradas.cell(row=3, column=2, value=VARIETY)
    entradas.cell(row=3, column=3, value=10)
    entradas.cell(row=3, column=4, value="Compra")
    entradas.cell(row=3, column=5, value=500)  # 50/g
    # Row 4: a negative adjustment on the earlier sale's own date, draining 8 g of the
    # cheap lot. Entradas write before any Ventas, and a tied-day stock entry ranks
    # ahead of a sale line, so this is always recorded before that sale draws stock.
    entradas.cell(row=4, column=1, value=date(2026, 1, 15))
    entradas.cell(row=4, column=2, value=VARIETY)
    entradas.cell(row=4, column=3, value=-8)
    entradas.cell(row=4, column=4, value="Ajuste")

    gastos = workbook.create_sheet(layout.GASTOS_SHEET)
    _titles(gastos, GASTOS_TITLES)

    ventas = workbook.create_sheet(layout.VENTAS_SHEET)
    _titles(ventas, VENTAS_TITLES)
    # Row 2: the LATER-dated sale, listed FIRST in the sheet.
    ventas.cell(row=2, column=1, value=date(2026, 1, 20))
    ventas.cell(row=2, column=2, value=VARIETY)
    ventas.cell(row=2, column=3, value=5)
    ventas.cell(row=2, column=4, value="Pendiente")
    ventas.cell(row=2, column=5, value=5000)
    ventas.cell(row=2, column=6, value=CUSTOMER)
    ventas.cell(row=2, column=7, value="")
    # Row 3: the EARLIER-dated sale, listed SECOND — date must still win. It shares
    # the adjustment's own date, so the adjustment lands before it.
    ventas.cell(row=3, column=1, value=date(2026, 1, 15))
    ventas.cell(row=3, column=2, value=VARIETY)
    ventas.cell(row=3, column=3, value=3)
    ventas.cell(row=3, column=4, value="Pendiente")
    ventas.cell(row=3, column=5, value=3000)
    ventas.cell(row=3, column=6, value=CUSTOMER)
    ventas.cell(row=3, column=7, value="")

    xlsx = _save_workbook(workbook, tmp_path, name="order.xlsx")
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),), name="order-mapping.csv")
    business_id = _business_id(engine)
    out, err = io.StringIO(), io.StringIO()

    code = run(
        [str(business_id), str(xlsx), str(mapping)], engine=engine, clock=clock, out=out, err=err
    )
    assert code == 0, err.getvalue()

    # 20 g bought in, 8 g adjusted out, 3 g + 5 g sold: 4 g left, all in the 100/g lot.
    stock = client.get("/stock").json()
    assert stock["varieties"][0]["grams"] == 4.0

    customers = client.get("/customers").json()
    assert len(customers) == 1
    customer_id = customers[0]["id"]
    assert customers[0]["balance"] == 8000
    # The earliest unpaid sale is the 01-15 one (row 3), not row 2's 01-20, whatever
    # the sheet's own order was.
    assert customers[0]["owing_since"] == "2026-01-15"

    account = client.get(f"/customers/{customer_id}/account").json()
    sale_rows = [row for row in account["rows"] if row["kind"] == "sale"]
    # The earlier-dated sale (3000, row 3) settles first, even though row 2 (5000)
    # comes first in the sheet.
    assert [row["sale"]["total"] for row in sale_rows] == [3000, 5000]
    assert [row["running_balance"] for row in sale_rows] == [3000, 8000]

    sale_ids = [row["sale"]["id"] for row in sale_rows]
    earliest_detail = client.get(f"/sales/{sale_ids[0]}").json()
    latest_detail = client.get(f"/sales/{sale_ids[1]}").json()
    # The adjustment drains 8 g of the 10 g, 50/g lot first (it is recorded before
    # every sale and ranks ahead of the earliest one on their shared day), leaving it
    # only 2 g: the earliest sale's 3 g spans both lots (2 g @ 50 + 1 g @ 100 = 200),
    # and the latest sale's 5 g comes entirely from the 100/g lot (500). Had sheet
    # order, rather than date, decided which lot came first, or had the adjustment
    # landed anywhere else, both figures would come out differently.
    assert earliest_detail["lines"][0]["cost"]["costed"] == 200
    assert latest_detail["lines"][0]["cost"]["costed"] == 500
