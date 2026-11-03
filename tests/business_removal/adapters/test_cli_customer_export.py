"""The removal command over a migrated, seeded database (ADR-0047): a customer in the
export carries its name, phone and customer type and no `channel`, and the ids it exports
are the ids the run deletes. A business with a typed customer is removed and its
`customer_type` rows are exported and deleted with it. Nothing in `app/business_removal` knows the column: the export
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


def _type_count(db_path: Path, business_name: str) -> int:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT count(*) FROM customer_type JOIN business ON business.id = "
            "customer_type.business_id WHERE business.name = ?",
            (business_name,),
        ).fetchone()
    return int(row[0])


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
        kind = client.post("/api/customer-types", json={"name": "Friends", "icon": "heart"})
        assert kind.status_code == 201, kind.text
        type_id = kind.json()["id"]
        typed = client.post(
            "/customers",
            json={"name": VIP_NAME, "phone": VIP_PHONE, "customer_type_id": type_id},
        )
        assert typed.status_code == 201, typed.text
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
    assert by_name[CUSTOMER_NAME]["customer_type_id"] is None
    assert by_name[NO_PHONE_NAME]["phone"] is None
    assert by_name[VIP_NAME]["phone"] == VIP_PHONE
    assert by_name[VIP_NAME]["customer_type_id"] == {"id": type_id, "name": "Friends"}
    # The frozen mark is kept as it was and never written for the typed customer.
    assert by_name[VIP_NAME]["vip"] is False
    types = json.loads(export.read_text())["kinds"]["customer_type"]
    assert [(t["id"], t["name"], t["icon"]) for t in types] == [(type_id, "Friends", "heart")]
    assert _type_count(db_path, "La Huerta") == 0
    assert _customer_ids(db_path, "La Huerta") == set()
    assert _customer_ids(db_path, "Otro Negocio") == staying_ids
