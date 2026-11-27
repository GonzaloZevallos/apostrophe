"""Home's Cash and Money in count an on-the-spot payment by its own stored amount, never by
its sale's total (GH-1063: a Deposit is an on-the-spot amount below the total).

Seam: `GET /panel` through `TestClient`, with the `client` fixture and the movable clock, at
both money scales. No code path stores a lower amount yet, so the test lowers it by hand.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from tests.conftest import NOW, TODAY, MovableClock

SALE_TOTAL = 1_000
STORED_AMOUNT = 400


def test_cash_and_money_in_count_the_lowered_stored_amount_not_the_sale_total(
    client: TestClient, engine: Engine, clock: MovableClock, money_scale: int
) -> None:
    clock.set(NOW)
    product = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": SALE_TOTAL},
    )
    sale = client.post(
        "/sales",
        json={
            "date": TODAY.isoformat(),
            "payment": {"kind": "paid", "payment_method_id": 1},
            "lines": [{"product_id": product["id"], "quantity": "1"}],
        },
    )
    assert sale.status_code == 201, sale.text
    before = client.get("/panel").json()
    assert before["periods"]["today"]["cash"] == SALE_TOTAL

    with engine.begin() as connection:
        lowered = connection.execute(
            text("UPDATE payment SET amount = :amount WHERE sale_id IS NOT NULL"),
            {"amount": STORED_AMOUNT * 10**money_scale},
        )
    assert lowered.rowcount == 1

    answer = client.get("/panel").json()

    assert answer["periods"]["today"]["cash"] == STORED_AMOUNT
    assert answer["today"]["money_in"]["total"] == STORED_AMOUNT
    assert [
        (method["payment_method_id"], method["amount"])
        for method in answer["today"]["money_in"]["methods"]
    ] == [(1, STORED_AMOUNT)]
