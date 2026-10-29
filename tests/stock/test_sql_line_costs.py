"""`SqlLineCosts` over a real database (CODING_STANDARDS section 5, ADR-0009): the
adapter `app/stock/adapters/line_costs.py` wires onto `app.state.line_costs`, run here
against real `stock_entry`, `sale` and `sale_line` rows instead of fakes — the gap the
fake-based `test_line_costs.py` leaves (`SqlDraws`/`SqlStockEntries` never touch SQL
there). Variety, stock entries and the sale itself come from the `client` fixture over
HTTP; only `SqlLineCosts` and `SqlSales.get` (just to rebuild the `Sale` to cost) are
built and called directly.
"""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.sales.adapters.sql_sales import SqlSales
from app.sales.application.ports import LineCost
from app.shared.quantity import Quantity
from app.stock.adapters.line_costs import SqlLineCosts
from app.varieties.adapters.tables import VarietyRow


def _variety_id(client: TestClient, list_price: int = 10_000) -> int:
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()
    variety_id = int(variety["id"])
    client.post(
        f"/varieties/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return variety_id


def _entry(client: TestClient, variety_id: int, **overrides: Any) -> None:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": "purchase", "grams": "5"}
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _business_id_of_variety(engine: Engine, variety_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(VarietyRow).where(VarietyRow.id == variety_id))
        assert row is not None
        return row.business_id


def test_a_line_spanning_two_lots_is_split_between_costed_and_pending(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    _entry(client, variety_id, grams="5", total_cost=5_000)
    _entry(client, variety_id, grams="3", total_cost=6_000)

    sale_response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]},
    )
    assert sale_response.status_code == 201, sale_response.text
    sale = sale_response.json()

    business_id = _business_id_of_variety(engine, variety_id)
    with Session(engine) as session:
        sales = SqlSales(session, business_id)
        line_costs = SqlLineCosts(session, business_id)
        stored_sale = sales.get(sale["id"])
        assert stored_sale is not None

        costs = line_costs.for_sale(stored_sale)

    # 8 g drawn from the two lots (5 g @ $5 000 + 3 g @ $6 000 = $11 000 exactly);
    # the remaining 2 g of the 10 g line have no lot behind them, so they are
    # pending, never a $0 cost.
    assert costs == [LineCost(costed=11_000, pending_quantity=Quantity.of("2"))]
