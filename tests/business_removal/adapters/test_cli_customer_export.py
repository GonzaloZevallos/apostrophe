"""The removal command over a migrated, seeded database (ADR-0047): a customer in the
export carries its name, phone and VIP and no `channel`, and the ids it exports are the
ids the run deletes. Nothing in `app/business_removal` knows the column: the export
follows the schema (ADR-0015)."""

from __future__ import annotations

import io
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.business_removal.adapters.cli import main
from tests.business_removal.adapters.seed import (
    CUSTOMER_NAME,
    EMAIL_LEAVING,
    PHONE,
    PINNED,
    build_app,
    seed,
    set_env,
)
from tests.conftest import MovableClock

NO_PHONE_NAME = "Sin Numero"
VIP_NAME = "Cliente Vip"
VIP_PHONE = "+5491166667777"


def _customer_ids(db_path: Path, business_name: str) -> set[int]:
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT customer.id FROM customer JOIN business ON business.id = "
            "customer.business_id WHERE business.name = ?",
            (business_name,),
        ).fetchall()
    return {int(row[0]) for row in rows}


def test_an_exported_customer_has_no_channel_and_the_ids_exported_are_the_ids_deleted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    token, _staying = seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    app, engine = build_app(db_path, clock)
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {token}"
        switches = client.put(
            "/pricing-settings", json={"is_bulk_pricing": False, "is_vip_customers": True}
        )
        assert switches.status_code == 200, switches.text
        assert client.post("/customers", json={"name": NO_PHONE_NAME}).status_code == 201
        vip = client.post("/customers", json={"name": VIP_NAME, "phone": VIP_PHONE, "vip": True})
        assert vip.status_code == 201, vip.text
    engine.dispose()

    with sqlite3.connect(db_path) as connection:
        columns = [row[1] for row in connection.execute("PRAGMA table_info(customer)")]
    assert "channel" not in columns
    leaving_ids = _customer_ids(db_path, "La Huerta")
    staying_ids = _customer_ids(db_path, "Otro Negocio")
    assert len(leaving_ids) == 3

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 0
    (export,) = export_dir.glob("*.json")
    records = json.loads(export.read_text())["kinds"]["customer"]
    assert {record["id"] for record in records} == leaving_ids
    assert all("channel" not in record for record in records)
    by_name = {record["name"]: record for record in records}
    assert by_name[CUSTOMER_NAME]["phone"] == PHONE
    assert by_name[CUSTOMER_NAME]["vip"] is False
    assert by_name[NO_PHONE_NAME]["phone"] is None
    assert by_name[VIP_NAME]["phone"] == VIP_PHONE
    assert by_name[VIP_NAME]["vip"] is True
    assert _customer_ids(db_path, "La Huerta") == set()
    assert _customer_ids(db_path, "Otro Negocio") == staying_ids
