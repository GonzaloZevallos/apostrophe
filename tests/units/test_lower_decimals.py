"""Lowering a unit's decimals through `PATCH /api/units/{id}`: one guarded statement refuses
it while any recorded quantity of the unit's products is finer than the new decimals, one
EXISTS per quantity column (invariants 5 and 7). Raising and renaming are never refused."""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Annotated, Any

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.db import get_session
from app.stock.adapters.tables import StockEntryRow
from app.units.adapters.router import get_units
from app.units.adapters.sql_units import SqlUnits
from tests.pricing_switches import set_switches

IN_USE = "unit.decimals_in_use"


def _kilos(client: TestClient, decimals: int = 2) -> int:
    created = client.post(
        "/api/units", json={"name": "Kilos", "label": "kg", "decimals": decimals}
    ).json()
    return int(created["id"])


def _product(client: TestClient, unit_id: int, name: str = "Gold") -> int:
    response = client.post("/api/products", json={"name": name, "unit_id": unit_id})
    assert response.status_code == 201, response.text
    product_id = int(response.json()["id"])
    price = client.post(
        f"/api/products/{product_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    assert price.status_code == 201, price.text
    return product_id


def _decimals(client: TestClient, unit_id: int) -> int:
    listed: list[dict[str, Any]] = client.get("/api/units").json()
    return int(next(u for u in listed if u["id"] == unit_id)["decimals"])


def _lower(client: TestClient, unit_id: int, decimals: int) -> Any:
    return client.patch(f"/api/units/{unit_id}", json={"decimals": decimals})


def _sale_line(client: TestClient, product_id: int, quantity: str) -> None:
    sold = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": quantity}]},
    )
    assert sold.status_code == 201, sold.text


def _entry(client: TestClient, product_id: int, quantity: str) -> None:
    created = client.post(
        "/stock/entries",
        json={"product_id": product_id, "origin": "opening_stock", "quantity": quantity},
    )
    assert created.status_code == 201, created.text


def _withdrawal_line(client: TestClient, product_id: int, quantity: str) -> None:
    _entry(client, product_id, "10")
    taken = client.post(
        "/stock/withdrawals",
        json={"reason": "promotion", "lines": [{"product_id": product_id, "quantity": quantity}]},
    )
    assert taken.status_code == 201, taken.text


def _threshold(client: TestClient, product_id: int, quantity: str) -> None:
    put = client.put(f"/stock/products/{product_id}/threshold", json={"quantity": quantity})
    assert put.status_code == 200, put.text


def _bulk_minimum(client: TestClient, product_id: int, quantity: str) -> None:
    created = client.post(
        f"/api/products/{product_id}/prices",
        json={
            "effective_from": "2026-02-01",
            "list_price": 11_000,
            "bulk_price": 10_000,
            "bulk_minimum": quantity,
        },
    )
    assert created.status_code == 201, created.text


COLUMNS: list[tuple[str, Callable[[TestClient, int, str], None]]] = [
    ("sale_line", _sale_line),
    ("stock_entry", _entry),
    ("stock_withdrawal_line", _withdrawal_line),
    ("stock_threshold", _threshold),
    ("price_entry", _bulk_minimum),
]


@pytest.fixture(autouse=True)
def bulk_pricing(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=True, vip=False)


@pytest.mark.parametrize(("column", "record"), COLUMNS, ids=[c for c, _ in COLUMNS])
def test_lowering_is_refused_when_only_that_column_holds_a_finer_quantity(
    client: TestClient, column: str, record: Callable[[TestClient, int, str], None]
) -> None:
    unit_id = _kilos(client)
    record(client, _product(client, unit_id), "2.55")

    refused = _lower(client, unit_id, 1)

    assert refused.status_code == 422
    assert refused.json()["code"] == IN_USE
    assert "2.55" not in refused.text and "Kilos" not in refused.text
    assert _decimals(client, unit_id) == 2


@pytest.mark.parametrize(("column", "record"), COLUMNS, ids=[c for c, _ in COLUMNS])
def test_lowering_to_zero_is_refused_by_a_tenth_in_that_column(
    client: TestClient, column: str, record: Callable[[TestClient, int, str], None]
) -> None:
    unit_id = _kilos(client)
    record(client, _product(client, unit_id), "2.5")

    assert _lower(client, unit_id, 1).status_code == 200
    refused = _lower(client, unit_id, 0)

    assert refused.status_code == 422
    assert refused.json()["code"] == IN_USE
    assert _decimals(client, unit_id) == 1


def test_lowering_succeeds_when_every_quantity_is_a_multiple_of_the_new_step(
    client: TestClient,
) -> None:
    unit_id = _kilos(client)
    product_id = _product(client, unit_id)
    _sale_line(client, product_id, "2.5")
    _entry(client, product_id, "4")
    _threshold(client, product_id, "1.5")
    _bulk_minimum(client, product_id, "3.5")

    lowered = _lower(client, unit_id, 1)

    assert lowered.status_code == 200
    assert lowered.json()["decimals"] == 1
    assert _decimals(client, unit_id) == 1


def test_lowering_renames_in_the_same_request_only_when_it_is_allowed(
    client: TestClient,
) -> None:
    unit_id = _kilos(client)
    _entry(client, _product(client, unit_id), "2.55")

    refused = client.patch(f"/api/units/{unit_id}", json={"name": "Renamed", "decimals": 1})

    assert refused.status_code == 422
    listed = client.get("/api/units").json()
    assert next(u for u in listed if u["id"] == unit_id)["name"] == "Kilos"


def test_a_quantity_of_another_units_product_does_not_hold_the_unit_back(
    client: TestClient,
) -> None:
    kilos = _kilos(client)
    other = int(
        client.post("/api/units", json={"name": "Pieces", "label": "pc", "decimals": 2}).json()[
            "id"
        ]
    )
    _entry(client, _product(client, other, "Fine"), "2.55")
    _product(client, kilos)

    assert _lower(client, kilos, 0).status_code == 200


def test_a_quantity_of_another_business_does_not_hold_the_unit_back(
    client: TestClient, other_client: TestClient
) -> None:
    mine = _kilos(client)
    theirs = _kilos(other_client)
    _entry(other_client, _product(other_client, theirs), "2.55")

    assert _lower(client, mine, 0).status_code == 200
    assert _lower(other_client, theirs, 0).status_code == 422


def test_raising_decimals_is_never_refused(client: TestClient) -> None:
    unit_id = _kilos(client, decimals=0)
    _entry(client, _product(client, unit_id), "3")

    assert _lower(client, unit_id, 2).status_code == 200
    assert _decimals(client, unit_id) == 2


def test_a_finer_quantity_committed_by_a_second_session_before_the_update_refuses_it(
    app: FastAPI, client: TestClient, engine: Engine
) -> None:
    """The use case has read the unit as lowerable; a second session then commits a finer
    quantity; the guarded UPDATE's own WHERE sees it and refuses, whatever was read before."""
    unit_id = _kilos(client)
    product_id = _product(client, unit_id)

    class SecondSessionRecordsFirst(SqlUnits):
        def lower_decimals(self, unit_id: int, decimals: int) -> bool:
            with Session(engine) as second:
                second.add(
                    StockEntryRow(
                        business_id=self._business_id,
                        entry_date=date(2026, 10, 2),
                        variety_id=product_id,
                        origin="opening_stock",
                        grams_hundredths=255,
                        recorded_at=datetime(2026, 10, 2, tzinfo=UTC),
                    )
                )
                second.commit()
            return super().lower_decimals(unit_id, decimals)

    def racing_units(
        session: Annotated[Session, Depends(get_session)], business_id: CurrentBusinessId
    ) -> SqlUnits:
        return SecondSessionRecordsFirst(session, business_id, app.state.units_finer_quantities)

    app.dependency_overrides[get_units] = racing_units

    refused = _lower(client, unit_id, 1)

    assert refused.status_code == 422
    assert refused.json()["code"] == IN_USE
    assert _decimals(client, unit_id) == 2
