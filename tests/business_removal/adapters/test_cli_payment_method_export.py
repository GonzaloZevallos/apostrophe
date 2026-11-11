"""Business removal and the payment methods (docs/adr/0085): the export carries each
payment's `payment_method_id` as `{id, name}` with the method's current name, `method`
(frozen) empty, and the methods themselves; the rows exported are the rows deleted; the
other business keeps every method and payment."""

from __future__ import annotations

import io
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.business_removal.adapters.cli import main
from tests.business_removal.adapters.seed import (
    EMAIL_LEAVING,
    PINNED,
    build_app,
    seed,
    set_env,
)
from tests.conftest import MovableClock


def _count(db_path: Path, table: str, business_name: str) -> int:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            f"SELECT count(*) FROM {table} JOIN business ON business.id = "
            f"{table}.business_id WHERE business.name = ?",
            (business_name,),
        ).fetchone()
    return int(row[0])


def test_the_export_carries_each_payment_s_method_by_id_and_current_name_and_deletes_them_all(
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
        methods = client.get("/api/payment-methods").json()
        first, second = methods[0], methods[1]
        # A later payment (seeded) points at `first`: rename it afterwards.
        renamed = client.patch(f"/api/payment-methods/{first['id']}", json={"name": "Efectivo"})
        assert renamed.status_code == 200, renamed.text
        product = client.get("/api/products").json()[0]
        spot = client.post(
            "/sales",
            json={
                "payment": {"kind": "paid", "payment_method_id": second["id"]},
                "lines": [{"product_id": product["id"], "quantity": 1, "special_price": 1000}],
            },
        )
        assert spot.status_code == 201, spot.text
        # An archived method stays in the export, with the payment that used it.
        assert client.post(f"/api/payment-methods/{second['id']}/archive").status_code == 204
    engine.dispose()

    payments_before = _count(db_path, "payment", "La Huerta")
    methods_before = _count(db_path, "payment_method", "La Huerta")
    staying_payments = _count(db_path, "payment", "Otro Negocio")
    staying_methods = _count(db_path, "payment_method", "Otro Negocio")
    assert payments_before >= 2
    assert methods_before == 2

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 0
    (export,) = export_dir.glob("*.json")
    kinds = json.loads(export.read_text())["kinds"]
    exported_methods = {record["id"]: record for record in kinds["payment_method"]}
    assert {record["name"] for record in exported_methods.values()} == {"Efectivo", second["name"]}
    assert len(kinds["payment"]) == payments_before
    assert len(exported_methods) == methods_before
    for payment in kinds["payment"]:
        reference = payment["payment_method_id"]
        assert reference == {
            "id": reference["id"],
            "name": exported_methods[reference["id"]]["name"],
        }
        assert payment["method"] is None
    assert {payment["payment_method_id"]["name"] for payment in kinds["payment"]} == {
        "Efectivo",
        second["name"],
    }
    assert _count(db_path, "payment", "La Huerta") == 0
    assert _count(db_path, "payment_method", "La Huerta") == 0
    assert _count(db_path, "payment", "Otro Negocio") == staying_payments
    assert _count(db_path, "payment_method", "Otro Negocio") == staying_methods
