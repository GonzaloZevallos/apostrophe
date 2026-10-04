"""`SqlDrawCosts` over a real database (CODING_STANDARDS section 5, ADR-0009,
ADR-0013): the adapter `app/stock/adapters/draw_costs.py` wires onto
`app.state.draw_costs`, run here against real `stock_entry`, `sale` and `sale_line`
rows instead of fakes — the gap the pure `period_figures` tests leave (`SqlDraws`
and `SqlStockEntries` never touch SQL there). The variety, stock entries and sale
come from the `client` fixture over HTTP; `GET /sales/{id}` gives each line's own
cost, already allocated through the same `allocate`/`lots_and_draws` pipeline
(`SqlLineCosts`) — every sale-line `DrawRow` must answer exactly the same costed
amount and pending grams, for a line split across lots and a gift alike, with no
shortfall ever mixed into a sale line."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.stock.adapters.draw_costs import SqlDrawCosts
from app.varieties.adapters.tables import VarietyRow


def _variety_id(client: TestClient, name: str, list_price: int = 10_000) -> int:
    variety = client.post("/varieties", json={"name": name}).json()
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


def test_draw_rows_match_get_sale_detail_s_line_cost_for_a_split_line_and_a_gift(
    client: TestClient, engine: Engine
) -> None:
    # A variety split across two lots: 8 g costed ($5 000 + $6 000 = $11 000), 2 g
    # of a 10 g line pending.
    split_variety = _variety_id(client, "Variedad dividida")
    _entry(client, split_variety, grams="5", total_cost=5_000)
    _entry(client, split_variety, grams="3", total_cost=6_000)

    # A fully costed variety, gifted on the same sale.
    gift_variety = _variety_id(client, "Variedad regalada")
    _entry(client, gift_variety, grams="5", total_cost=2_000)

    # An unrelated variety, drawn down by a negative adjustment: a shortfall, never
    # a sale line, and never mixed into either line above.
    shortfall_variety = _variety_id(client, "Variedad con faltante")
    _entry(client, shortfall_variety, grams="4", total_cost=4_000)
    adjustment = client.post(
        "/stock/entries",
        json={"variety_id": shortfall_variety, "origin": "adjustment", "grams": "-1"},
    )
    assert adjustment.status_code == 201, adjustment.text

    sale = client.post(
        "/sales",
        json={
            "payment": "cash",
            "lines": [
                {"variety_id": split_variety, "grams": "10"},
                {"variety_id": gift_variety, "grams": "2", "gift": True},
            ],
        },
    ).json()

    detail = client.get(f"/sales/{sale['id']}").json()
    line_by_variety = {line["variety_id"]: line for line in detail["lines"]}

    business_id = _business_id_of_variety(engine, split_variety)
    with Session(engine) as session:
        rows = SqlDrawCosts(session, business_id).rows()

    sale_rows_by_variety = {
        row.variety_id: row for row in rows if row.kind != "shortfall" and row.sale_id == sale["id"]
    }

    split_row = sale_rows_by_variety[split_variety]
    split_line = line_by_variety[split_variety]
    assert split_row.kind == "sold"
    assert split_row.costed == split_line["cost"]["costed"] == 11_000
    assert float(split_row.pending.as_decimal()) == split_line["cost"]["pending_grams"] == 2.0

    gift_row = sale_rows_by_variety[gift_variety]
    gift_line = line_by_variety[gift_variety]
    assert gift_row.kind == "gifted"
    assert gift_row.costed == gift_line["cost"]["costed"] == 800
    assert float(gift_row.pending.as_decimal()) == gift_line["cost"]["pending_grams"] == 0.0

    shortfall_rows = [row for row in rows if row.kind == "shortfall"]
    assert len(shortfall_rows) == 1
    assert shortfall_rows[0].sale_id is None
    assert shortfall_rows[0].variety_id is None
    # 1 g out of the 4 g @ $4 000 lot: $1 000, fully costed.
    assert shortfall_rows[0].costed == 1_000
    assert float(shortfall_rows[0].pending.as_decimal()) == 0.0
