"""Sales and prices over a business that stores hundredths (docs/adr/0058).

Seams: the sales and products repositories over a scale-2 session, the sales and prices HTTP
routes through `TestClient`, and the Catalog text. The suite's `SCALES` stays `(0,)` until
the flip, so scale 2 is opened here by hand, through the app's own opening wiring.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.main import create_app
from app.products.adapters.sql_products import SqlProducts
from app.products.application.manage_prices import record_price_entry
from app.products.domain.product import PriceEntry, Product, ProductName
from app.sales.adapters.sql_sales import SqlSales
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import PriceQuote, VarietyPricing
from app.sales.domain.sale import Sale
from app.shared.money import TooManyDecimals
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity
from tests.conftest import NOW, SETTINGS, TEST_HASHER, MovableClock, open_business, signed_in
from tests.fakes.money_format import WholeAmounts
from tests.fakes.telegram import FakeTelegram

DAY = "2026-10-02"


def _client_at(scale: int, clock: MovableClock) -> Iterator[tuple[TestClient, Engine]]:
    engine = make_engine("sqlite://")
    app = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
        opening_money_scale=scale,
    )
    with TestClient(app) as http:
        token = open_business(http, engine, clock, f"Negocio {scale}", f"s{scale}@example.com")
        yield signed_in(http, token), engine
    engine.dispose()


@pytest.fixture
def scale_two(clock: MovableClock) -> Iterator[tuple[TestClient, Engine]]:
    yield from _client_at(2, clock)


@pytest.fixture
def scale_zero(clock: MovableClock) -> Iterator[tuple[TestClient, Engine]]:
    yield from _client_at(0, clock)


def _raw(engine: Engine, sql: str) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        return [tuple(row) for row in connection.execute(text(sql)).all()]


def _business_id(engine: Engine) -> int:
    return int(_raw(engine, "SELECT id FROM business")[0][0])


def _product(client: TestClient, **prices: int | str) -> int:
    product = client.post("/api/products", json={"name": "Lavanda"}).json()
    response = client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000, **prices},
    )
    assert response.status_code == 201, response.text
    return int(product["id"])


def _sell(client: TestClient, product_id: int, **body: Any) -> dict[str, Any]:
    response = client.post(
        "/sales",
        json={
            "lines": [{"product_id": product_id, "quantity": "2"}],
            "payment": "cash",
            "date": DAY,
            **body,
        },
    )
    assert response.status_code == 201, response.text
    sale: dict[str, Any] = response.json()
    return sale


def test_a_price_entry_is_stored_in_hundredths_and_read_back_as_the_domain_amount(
    scale_two: tuple[TestClient, Engine],
) -> None:
    client, engine = scale_two
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True})
    product_id = _product(client, bulk_price=9_000, bulk_minimum="5")

    assert _raw(engine, "SELECT list_price, bulk_price FROM price_entry") == [(1_100_000, 900_000)]
    with Session(engine) as session:
        product = SqlProducts(session, _business_id(engine)).get(product_id)
    assert product is not None
    (entry,) = product.price_entries
    assert (entry.list_price, entry.bulk.price if entry.bulk else None) == (11_000, 9_000)


def test_a_price_entry_added_by_the_repository_is_stored_in_hundredths(
    scale_two: tuple[TestClient, Engine],
) -> None:
    _, engine = scale_two
    with Session(engine) as session:
        products = SqlProducts(session, _business_id(engine))
        added = products.add(Product(ProductName.of("Rosa")))
        assert added.id is not None
        added.record_price(PriceEntry.of(date(2026, 1, 1), 12_500))
        stored = products.save(added)
        session.commit()

    assert [e.list_price for e in stored.price_entries] == [12_500]
    assert _raw(engine, "SELECT list_price FROM price_entry") == [(1_250_000,)]


def test_a_sale_is_stored_in_hundredths_and_the_repository_reads_it_back(
    scale_two: tuple[TestClient, Engine],
) -> None:
    client, engine = scale_two
    product_id = _product(client)

    sale = _sell(client, product_id, shipping_charged=1_500)

    assert sale["shipping_charged"] == 1_500
    assert sale["total"] == 23_500
    assert _raw(engine, "SELECT shipping_charged FROM sale") == [(150_000,)]
    assert _raw(engine, "SELECT price_per_gram, line_total FROM sale_line") == [
        (1_100_000, 2_200_000)
    ]
    assert _raw(engine, "SELECT amount FROM payment") == [(2_350_000,)]
    with Session(engine) as session:
        view = SqlSales(session, _business_id(engine)).get_view(sale["id"])
    assert view is not None
    assert view.sale.shipping_charged == 1_500
    assert [line.line.line_total for line in view.lines] == [22_000]
    assert view.sale.payment is not None and view.sale.payment.amount == 23_500


def test_the_sales_ledger_sums_in_whole_units_at_scale_2(
    scale_two: tuple[TestClient, Engine],
) -> None:
    from app.sales.adapters.sales_ledger import SqlSalesLedger

    client, engine = scale_two
    _sell(client, _product(client), shipping_charged=1_500)

    with Session(engine) as session:
        (record,) = SqlSalesLedger(session, _business_id(engine)).all()

    assert (record.shipping, record.total) == (1_500, 23_500)


def test_the_same_data_answers_the_same_sale_and_catalog_text_at_both_scales(
    scale_zero: tuple[TestClient, Engine], scale_two: tuple[TestClient, Engine]
) -> None:
    answers = []
    for client, _ in (scale_zero, scale_two):
        product_id = _product(client, bulk_price=9_000, bulk_minimum="5")
        client.post(
            "/stock/entries",
            json={"product_id": product_id, "origin": "opening_stock", "quantity": "50"},
        )
        sale = _sell(client, product_id, shipping_charged=1_500)
        sale.pop("id")
        sale["lines"][0].pop("product_id")
        catalog = client.get("/catalog").json()["text"]
        listed = client.get("/sales").json()
        answers.append((sale, catalog, [(s["total"], s["shipping_charged"]) for s in listed]))

    assert answers[0] == answers[1]
    assert "11.000" in answers[0][1]


@pytest.mark.parametrize("field", ["shipping_charged", "special_price"])
def test_a_sale_amount_with_a_decimal_is_refused_before_anything_is_saved(field: str) -> None:
    line = LineInput(
        variety_id=1,
        quantity=Quantity.of("1"),
        special_price=Decimal("10.5") if field == "special_price" else None,
    )
    shipping = Decimal("10.5") if field == "shipping_charged" else Decimal(0)

    with pytest.raises(TooManyDecimals) as refused:
        _record_with(line, shipping)

    assert str(refused.value) == "the amount has more decimals than the business allows"
    assert refused.value.code == "money.too_many_decimals"


def _record_with(line: LineInput, shipping: Decimal) -> Sale:
    refuses_to_store: Any = _Counting()
    return record_sale(
        refuses_to_store,
        _PricesAnyProduct(),
        _NoCustomers(),
        _BothOff(),
        WholeAmounts(),
        refuses_to_store,
        sale_date=date(2026, 10, 2),
        today=date(2026, 10, 2),
        customer_id=None,
        shipping_charged=shipping,
        note=None,
        lines=[line],
        method=None,
        left_owing=False,
        recorded_at=NOW,
    )


class _Counting:
    """Stands in for the sales store and the unit of work: touching either fails."""

    def __getattr__(self, name: str) -> Any:
        raise AssertionError(f"nothing is stored before the amounts are checked: {name}")


class _NoCustomers:
    def get(self, customer_id: int) -> None:
        return None


class _BothOff:
    def current(self) -> PricingSettings:
        return PricingSettings(is_bulk_pricing=False, is_vip_customers=False)


class _PricesAnyProduct:
    def for_variety(self, variety_id: int, day: date) -> VarietyPricing:
        return VarietyPricing(
            variety_id=variety_id,
            current=PriceQuote(list_price=11_000, bulk=None, vip_price=None),
        )


@pytest.mark.parametrize("field", ["list_price", "bulk_price", "vip_price"])
def test_a_price_with_a_decimal_is_refused_and_nothing_is_saved(
    scale_zero: tuple[TestClient, Engine], field: str
) -> None:
    _, engine = scale_zero
    with Session(engine) as session:
        products = SqlProducts(session, _business_id(engine))
        product = products.add(Product(ProductName.of("Lavanda")))
        session.commit()

    with Session(engine) as session, pytest.raises(TooManyDecimals) as refused:
        record_price_entry(
            SqlProducts(session, _business_id(engine)),
            _BothOn(),
            WholeAmounts(),
            session,
            product.id or 0,
            date(2026, 1, 1),
            Decimal("10.5") if field == "list_price" else Decimal(11_000),
            Decimal("10.5") if field == "bulk_price" else Decimal(9_000),
            Quantity.of("5"),
            vip_price=Decimal("10.5") if field == "vip_price" else Decimal(8_000),
        )

    assert refused.value.code == "money.too_many_decimals"
    assert _raw(engine, "SELECT count(*) FROM price_entry") == [(0,)]


class _BothOn:
    def current(self) -> PricingSettings:
        return PricingSettings(is_bulk_pricing=True, is_vip_customers=True)


def test_money_on_the_sales_and_prices_routes_is_a_json_integer_at_scale_0(
    scale_zero: tuple[TestClient, Engine],
) -> None:
    client, _ = scale_zero
    product_id = _product(client)
    sale = _sell(client, product_id, shipping_charged=1_500)

    entry = client.get(f"/api/products/{product_id}/prices").json()[0]
    shapes = [
        sale["shipping_charged"],
        sale["total"],
        sale["lines"][0]["price_per_gram"],
        sale["lines"][0]["line_total"],
        entry["list_price"],
    ]
    assert all(type(value) is int for value in shapes)
    assert shapes == [1_500, 23_500, 11_000, 22_000, 11_000]
