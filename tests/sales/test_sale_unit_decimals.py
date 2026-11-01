"""A quantity finer than the product's unit is refused where it is recorded, and nothing is
written: the sale line and the bulk minimum, at 0, 1 and 2 decimals (invariants 4 and 5)."""

from collections.abc import Collection

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.products.adapters.tables import PriceEntryRow
from app.sales.adapters.tables import SaleLineRow, SaleRow
from app.shared.unit import Unit
from tests.fakes.units import set_unit_decimals
from tests.pricing_switches import set_switches

# decimals -> (a quantity the unit admits, one decimal too fine for it)
CASES = [(0, "3", "3.5"), (1, "3.5", "3.55"), (2, "3.55", "3.555")]


def _product(client: TestClient) -> int:
    created = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{created['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(created["id"])


def _sell(client: TestClient, product_id: int, quantity: str) -> int:
    return client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": quantity}]},
    ).status_code


def _count(engine: Engine, row: type) -> int:
    with Session(engine) as session:
        return session.scalar(select(func.count()).select_from(row)) or 0


@pytest.mark.parametrize(("decimals", "admitted", "too_fine"), CASES)
def test_a_sale_line_finer_than_the_unit_is_refused_and_writes_nothing(
    client: TestClient, engine: Engine, decimals: int, admitted: str, too_fine: str
) -> None:
    set_unit_decimals(engine, decimals)
    product_id = _product(client)

    refused = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": too_fine}]},
    )

    assert refused.status_code == 422
    assert refused.json()["code"] == "quantity.too_many_decimals"
    assert (_count(engine, SaleRow), _count(engine, SaleLineRow)) == (0, 0)
    assert _sell(client, product_id, admitted) == 201
    assert _count(engine, SaleLineRow) == 1


@pytest.mark.parametrize(("decimals", "admitted", "too_fine"), CASES)
def test_a_bulk_minimum_finer_than_the_unit_is_refused_and_writes_nothing(
    client: TestClient, engine: Engine, decimals: int, admitted: str, too_fine: str
) -> None:
    set_switches(engine, bulk=True, vip=False)
    set_unit_decimals(engine, decimals)
    product_id = int(client.post("/api/products", json={"name": "Lavanda"}).json()["id"])

    def price(minimum: str) -> int:
        return client.post(
            f"/api/products/{product_id}/prices",
            json={
                "effective_from": "2026-01-01",
                "list_price": 11_000,
                "bulk_price": 10_000,
                "bulk_minimum": minimum,
            },
        ).status_code

    refused = client.post(
        f"/api/products/{product_id}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 11_000,
            "bulk_price": 10_000,
            "bulk_minimum": too_fine,
        },
    )

    assert refused.status_code == 422
    assert refused.json()["code"] == "quantity.too_many_decimals"
    assert _count(engine, PriceEntryRow) == 0
    assert price(admitted) == 201
    assert _count(engine, PriceEntryRow) == 1


def test_a_sale_of_a_product_missing_from_the_units_is_gone_not_too_precise(
    client: TestClient,
) -> None:
    assert _sell(client, 999_999, "1.5") == 404


def test_decimals_lowered_between_the_first_read_and_the_write_refuse_and_write_nothing(
    app: FastAPI, client: TestClient, engine: Engine
) -> None:
    """A partner lowers the unit right after the use case's first read: the read after
    the write sees it, the sale is rolled back and nothing is stored."""
    set_unit_decimals(engine, 2)
    product_id = _product(client)
    real = app.state.sales_units
    rollbacks: list[int] = []

    class LowersAfterTheFirstRead:
        def __init__(self, session: Session, business_id: int) -> None:
            self._session = session
            self._reader = real(session, business_id)
            self._reads = 0
            event.listen(session, "after_rollback", lambda _session: rollbacks.append(1))

        def units_of(self, product_ids: Collection[int]) -> dict[int, Unit]:
            found: dict[int, Unit] = self._reader.units_of(product_ids)
            self._reads += 1
            if self._reads == 1:
                self._session.execute(text("UPDATE unit SET decimals = 0"))
            return found

    app.state.sales_units = LowersAfterTheFirstRead

    refused = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": "1.5"}]},
    )

    assert refused.status_code == 422
    assert refused.json()["code"] == "quantity.too_many_decimals"
    assert (_count(engine, SaleRow), _count(engine, SaleLineRow)) == (0, 0)
    # The use case itself undid the write: a rollback ran before the refusal was raised.
    assert rollbacks


def test_a_bulk_minimum_refused_after_the_write_when_the_unit_lost_decimals_stores_nothing(
    app: FastAPI, client: TestClient, engine: Engine
) -> None:
    """The same race on a price entry: the unit loses its decimals right after the first
    read, the read after the write sees it, the entry is rolled back and not stored."""
    set_switches(engine, bulk=True, vip=False)
    set_unit_decimals(engine, 2)
    product_id = int(client.post("/api/products", json={"name": "Lavanda"}).json()["id"])
    real = app.state.products_units

    class LowersAfterTheFirstRead:
        def __init__(self, session: Session, business_id: int) -> None:
            self._session = session
            self._reader = real(session, business_id)
            self._reads = 0

        def units_of(self, product_ids: Collection[int]) -> dict[int, Unit]:
            found: dict[int, Unit] = self._reader.units_of(product_ids)
            self._reads += 1
            if self._reads == 1:
                self._session.execute(text("UPDATE unit SET decimals = 0"))
            return found

    app.state.products_units = LowersAfterTheFirstRead

    refused = client.post(
        f"/api/products/{product_id}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 11_000,
            "bulk_price": 10_000,
            "bulk_minimum": "3.5",
        },
    )

    assert refused.status_code == 422
    assert refused.json()["code"] == "quantity.too_many_decimals"
    assert _count(engine, PriceEntryRow) == 0
