"""`SqlStockFigures` over a real database (CODING_STANDARDS section 5; plan invariant:
one `lots_and_draws` load per request): entries and sale-line draws are each read
exactly once per `.read()` call, whatever the number of varieties, sales or entries.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.products.adapters.tables import ProductRow
from app.stock.adapters.stock_figures import SqlStockFigures
from tests.conftest import TODAY


def _variety(client: TestClient, name: str, list_price: int = 10_000) -> int:
    variety = client.post("/api/products", json={"name": name}).json()
    variety_id = int(variety["id"])
    client.post(
        f"/api/products/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return variety_id


def _entry(client: TestClient, variety_id: int, **overrides: Any) -> None:
    body: dict[str, Any] = {"product_id": variety_id, "origin": "purchase", "quantity": "5"}
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _business_id_of_variety(engine: Engine, variety_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(ProductRow).where(ProductRow.id == variety_id))
        assert row is not None
        return row.business_id


def test_reads_entries_and_draws_exactly_once_whatever_the_number_of_varieties(
    client: TestClient, engine: Engine
) -> None:
    lavanda = _variety(client, "Lavanda")
    menta = _variety(client, "Menta")
    for variety_id in (lavanda, menta):
        _entry(client, variety_id, quantity="10", total_cost=1_000)
        sale = client.post(
            "/sales",
            json={"payment": "cash", "lines": [{"variety_id": variety_id, "quantity": "2"}]},
        )
        assert sale.status_code == 201, sale.text

    business_id = _business_id_of_variety(engine, lavanda)
    session = Session(engine)
    figures = SqlStockFigures(session, business_id)

    statements: list[str] = []

    def _record(
        conn: object, cursor: object, statement: str, parameters: object, *args: object
    ) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", _record)
    try:
        figures.read(TODAY)
    finally:
        event.remove(engine, "before_cursor_execute", _record)

    entry_reads = [s for s in statements if "stock_entry" in s]
    draw_reads = [s for s in statements if "sale_line" in s]
    assert len(entry_reads) == 1, entry_reads
    assert len(draw_reads) == 1, draw_reads


def test_rows_include_a_variety_with_no_entries_and_translate_stock_level(
    client: TestClient, engine: Engine
) -> None:
    priced = _variety(client, "Lavanda")
    untouched = _variety(client, "Zarzamora")
    _entry(client, priced, quantity="10", total_cost=1_000)

    business_id = _business_id_of_variety(engine, priced)
    with Session(engine) as session:
        figures = SqlStockFigures(session, business_id)
        answer = figures.read(TODAY)

    by_id = {row.variety_id: row for row in answer.rows}
    assert by_id[priced].status == "ok"
    assert by_id[untouched].status == "no_entries"
    assert by_id[untouched].name == "Zarzamora"


def test_draws_are_costed_the_same_way_sql_draw_costs_answers_them(
    client: TestClient, engine: Engine
) -> None:
    """`read`'s `draws` go through the same shared builder `SqlDrawCosts` uses (plan
    invariant: one draw-row builder in `app/stock/adapters/`), so a sale-line draw
    here costs exactly what `GET /analysis`'s own `DrawCosts` port would answer for it."""
    variety_id = _variety(client, "Lavanda")
    _entry(client, variety_id, quantity="10", total_cost=1_000)
    sale = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "quantity": "10"}]},
    )
    assert sale.status_code == 201, sale.text

    business_id = _business_id_of_variety(engine, variety_id)
    with Session(engine) as session:
        figures = SqlStockFigures(session, business_id)
        answer = figures.read(TODAY)

    sale_draws = [d for d in answer.draws if d.kind != "shortfall"]
    assert len(sale_draws) == 1
    assert sale_draws[0].costed == 1_000
    assert sale_draws[0].variety_id == variety_id
