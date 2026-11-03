"""The spreadsheet import joins a VIP of the sheet to the business's VIP type, found by
its `is_vip` mark and never by its name (docs/adr/0070). Seam: `cli.run` over the real
`.xlsx` fixture, every figure read back through the HTTP API.
"""

from __future__ import annotations

import io
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.shared.copy import OperatorText
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)

TAKEN = "import.vip_type_name_taken"


def _import(
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    text: OperatorText,
    *,
    vip: bool = True,
    dry_run: bool = False,
) -> tuple[int, str, str]:
    workbook = _workbook()
    if vip:
        sheet = workbook["Ventas"]
        sheet.cell(row=2, column=7, value="Amigo")
    xlsx = _save_workbook(workbook, tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    argv = [str(_business_id(engine)), str(xlsx), "--mapping", str(mapping)]
    out, err = io.StringIO(), io.StringIO()
    code = run(
        [*argv, "--dry-run"] if dry_run else argv,
        engine=engine,
        clock=clock,
        out=out,
        err=err,
        text=text,
    )
    return code, out.getvalue(), err.getvalue()


def _types(engine: Engine) -> list[CustomerTypeRow]:
    with Session(engine) as session:
        rows = list(session.scalars(select(CustomerTypeRow).order_by(CustomerTypeRow.id)))
        session.expunge_all()
        return rows


def test_a_vip_of_the_sheet_joins_a_vip_type_the_import_creates(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    code, _out, err = _import(engine, clock, tmp_path, operator_text_en)

    assert code == 0, err
    [vip_type] = _types(engine)
    assert (vip_type.name, vip_type.icon, vip_type.is_vip) == ("VIP", "star", True)
    [customer] = client.get("/customers").json()
    assert customer["customer_type_id"] == vip_type.id
    assert customer["vip"] is True


def test_no_vip_in_the_sheet_means_no_type_and_no_check(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    client.post("/api/customer-types", json={"name": "vip"})

    code, _out, err = _import(engine, clock, tmp_path, operator_text_en, vip=False)

    assert code == 0, err
    [taken] = _types(engine)
    assert taken.is_vip is False
    [customer] = client.get("/customers").json()
    assert customer["customer_type_id"] is None


def test_a_dry_run_and_a_real_run_refuse_when_another_type_holds_the_name(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    client.post("/api/customer-types", json={"name": " vip "})

    for dry_run in (True, False):
        code, out, _err = _import(engine, clock, tmp_path, operator_text_en, dry_run=dry_run)

        # The report prints the refusal, with the fix in the Operator's words, and
        # nothing about a customer or an amount.
        assert TAKEN in out
        assert "rename or delete it" in out
        assert "Writable: no" in out
        assert CUSTOMER not in out
        assert code == (0 if dry_run else 1)

    assert client.get("/api/products").json() == []
    assert client.get("/customers").json() == []
    [taken] = _types(engine)
    assert taken.is_vip is False


def test_a_vip_type_renamed_to_something_else_is_joined(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    with Session(engine) as session:
        session.add(
            CustomerTypeRow(
                business_id=_business_id(engine),
                name="Friends",
                name_key="friends",
                icon="heart",
                is_vip=True,
            )
        )
        session.commit()
    client.post("/api/customer-types", json={"name": "VIP"})

    code, _out, err = _import(engine, clock, tmp_path, operator_text_en)

    assert code == 0, err
    friends, _decoy = _types(engine)
    [customer] = client.get("/customers").json()
    assert customer["customer_type_id"] == friends.id
    assert len(_types(engine)) == 2


def test_a_deleted_vip_type_is_recreated_as_exactly_one_vip_row(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    # A business that had a VIP type and deleted it: no VIP row, no 'VIP' name left.
    code, _out, err = _import(engine, clock, tmp_path, operator_text_en, dry_run=True)
    assert code == 0, err
    assert _types(engine) == []

    code, _out, err = _import(engine, clock, tmp_path, operator_text_en)

    assert code == 0, err
    rows = _types(engine)
    assert [row.is_vip for row in rows] == [True]
