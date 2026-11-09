"""Stock entries, purchases and the stock figures over a business that stores hundredths
(docs/adr/0058).

Seams: the stock repositories and figure readers over a scale-2 session, and the stock HTTP
routes through `TestClient`. The suite's `SCALES` stays `(0,)` until the flip, so scale 2 is
opened here through the app's own opening wiring.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import money_stored_value
from app.shared.money import Money, MoneyNotRepresentable
from app.stock.adapters.purchases import SqlPurchases
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.stock_figures import SqlStockFigures
from app.stock.adapters.tables import StockEntryRow
from tests.conftest import NOW, TODAY
from tests.money_wire import assert_money_is_int


@pytest.fixture(params=(0, 2))
def money_scale(request: pytest.FixtureRequest) -> int:
    """This module opens its businesses at both scales; the `app` fixture hands the scale
    to the opening wiring."""
    scale: int = request.param
    return scale


def _stored(units: int, scale: int) -> int:
    factor: int = 10**scale
    return units * factor


def _raw(engine: Engine, sql: str) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        return [tuple(row) for row in connection.execute(text(sql)).all()]


def _business_id(engine: Engine) -> int:
    return int(_raw(engine, "SELECT id FROM business")[0][0])


def _product(client: TestClient) -> int:
    product = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(product["id"])


def _purchase(client: TestClient, product_id: int, quantity: str, total_cost: Any) -> Any:
    return client.post(
        "/stock/entries",
        json={
            "product_id": product_id,
            "origin": "purchase",
            "quantity": quantity,
            "total_cost": total_cost,
        },
    )


def test_a_purchase_cost_is_stored_at_the_business_scale_and_read_back_whole(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    product_id = _product(client)

    created = _purchase(client, product_id, "4", 85_000)

    assert created.status_code == 201, created.text
    assert created.json()["total_cost"] == 85_000
    assert created.json()["cost_per_gram"] == 21_250
    assert_money_is_int(created.json(), "total_cost", "cost_per_gram")
    assert _raw(engine, "SELECT total_cost FROM stock_entry") == [(_stored(85_000, money_scale),)]
    fetched = client.get(f"/stock/entries/{created.json()['id']}").json()
    assert (fetched["total_cost"], fetched["cost_per_gram"]) == (85_000, 21_250)
    edited = client.put(
        f"/stock/entries/{created.json()['id']}",
        json={
            "product_id": product_id,
            "origin": "purchase",
            "quantity": "4",
            "total_cost": 90_000,
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["total_cost"] == 90_000
    assert _raw(engine, "SELECT total_cost FROM stock_entry") == [(_stored(90_000, money_scale),)]


def test_an_entry_without_a_cost_stays_null(client: TestClient, engine: Engine) -> None:
    product_id = _product(client)

    created = client.post(
        "/stock/entries", json={"product_id": product_id, "origin": "harvest", "quantity": "5"}
    )

    assert created.status_code == 201, created.text
    assert created.json()["total_cost"] is None
    assert _raw(engine, "SELECT total_cost FROM stock_entry") == [(None,)]


def test_a_purchase_whose_cost_divides_unevenly_costs_the_same_at_both_scales(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    product_id = _product(client)
    created = _purchase(client, product_id, "3", 1_000)
    assert created.status_code == 201, created.text
    sale = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": "2"}]},
    )
    assert sale.status_code == 201, sale.text

    with Session(engine) as session:
        answer = SqlStockFigures(session, _business_id(engine)).read(TODAY)

    # The same figures at scale 0 and at scale 2: 1000 over 3 grams, rounded half up to
    # the whole unit, never to the hundredth.
    assert created.json()["cost_per_gram"] == 333
    (draw,) = answer.draws
    assert (draw.costed, draw.pending.hundredths, draw.line_total) == (667, 0, 20_000)


def test_the_purchases_and_the_draws_a_scale_two_session_reads_are_whole_units(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    product_id = _product(client)
    _purchase(client, product_id, "5", 7_500)
    client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": "2"}]},
    )
    business_id = _business_id(engine)

    with Session(engine) as session:
        purchases = SqlPurchases(session, business_id).purchases()
        draws = SqlDraws(session, business_id).for_varieties(None)
        entries = SqlStockEntries(session, business_id).for_varieties(None)

    assert [purchase.total_cost for purchase in purchases] == [7_500]
    assert [draw.line_total for draw in draws] == [20_000]
    assert [entry.total_cost for entry in entries] == [7_500]


@pytest.mark.parametrize("method", ["post", "put"])
def test_a_cost_with_a_decimal_is_refused_and_nothing_is_saved(
    client: TestClient, engine: Engine, money_scale: int, method: str
) -> None:
    product_id = _product(client)
    body = {"product_id": product_id, "origin": "purchase", "quantity": "4", "total_cost": 10.5}
    if method == "post":
        refused = client.post("/stock/entries", json=body)
    else:
        existing = _purchase(client, product_id, "4", 1_000).json()["id"]
        refused = client.put(f"/stock/entries/{existing}", json=body)

    assert refused.status_code == 422
    assert refused.json()["code"] == "money.too_many_decimals"
    assert "10.5" not in refused.text
    expected = [] if method == "post" else [(_stored(1_000, money_scale),)]
    assert _raw(engine, "SELECT total_cost FROM stock_entry") == expected


def test_a_cost_written_with_zero_decimals_is_accepted(client: TestClient) -> None:
    product_id = _product(client)

    assert _purchase(client, product_id, "4", 1_000.0).status_code == 201


def test_a_stored_cost_with_cents_is_an_integrity_failure_not_a_rounded_figure(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    if money_scale != 2:
        pytest.skip("only a business that stores hundredths can hold cents")
    product_id = _product(client)
    business_id = _business_id(engine)
    with Session(engine) as session:
        session.add(
            StockEntryRow(
                business_id=business_id,
                entry_date=NOW.date(),
                variety_id=product_id,
                origin="purchase",
                grams_hundredths=400,
                total_cost=money_stored_value(session, business_id, Money(150)),
                note=None,
                recorded_at=NOW,
            )
        )
        session.commit()

    with Session(engine) as session, pytest.raises(MoneyNotRepresentable) as failed:
        SqlStockEntries(session, business_id).for_varieties(None)
    assert "1.5" not in str(failed.value)
    with Session(engine) as session, pytest.raises(MoneyNotRepresentable):
        SqlPurchases(session, business_id).purchases()
