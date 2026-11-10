"""Sales and prices over a business that stores hundredths (docs/adr/0058).

Seams: the sales and products repositories over a scale-2 session, the sales and prices HTTP
routes through `TestClient`, and the Catalog text. The suite's `SCALES` stays `(0,)` until
the flip, so scale 2 is opened here by hand, through the app's own opening wiring.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.domain.product import CatalogPrice
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
from tests.conftest import NOW
from tests.fakes.money_format import WholeAmounts
from tests.money_wire import assert_money_is_int
from tests.payment_body import payment_body

DAY = "2026-10-02"


@pytest.fixture(params=(0, 2))
def money_scale(request: pytest.FixtureRequest) -> int:
    """This module opens its businesses at both scales; the suite's own `SCALES` stays (0,)
    until the flip, and the `app` fixture hands the scale to the opening wiring."""
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
            "payment": {"kind": "paid", "payment_method_id": 1},
            "date": DAY,
            **{**body, **({"payment": payment_body(body["payment"])} if "payment" in body else {})},
        },
    )
    assert response.status_code == 201, response.text
    sale: dict[str, Any] = response.json()
    return sale


def test_a_price_entry_is_stored_at_the_business_scale_and_read_back_as_the_domain_amount(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True})
    product_id = _product(client, bulk_price=9_000, bulk_minimum="5")

    assert _raw(engine, "SELECT list_price, bulk_price FROM price_entry") == [
        (_stored(11_000, money_scale), _stored(9_000, money_scale))
    ]
    with Session(engine) as session:
        product = SqlProducts(session, _business_id(engine)).get(product_id)
    assert product is not None
    (entry,) = product.price_entries
    assert (entry.list_price, entry.bulk.price if entry.bulk else None) == (11_000, 9_000)


def test_a_price_entry_added_by_the_repository_is_stored_at_the_business_scale(
    engine: Engine, client: TestClient, money_scale: int
) -> None:
    with Session(engine) as session:
        products = SqlProducts(session, _business_id(engine))
        added = products.add(Product(ProductName.of("Rosa")))
        assert added.id is not None
        added.record_price(PriceEntry.of(date(2026, 1, 1), 12_500))
        stored = products.save(added)
        session.commit()

    assert [e.list_price for e in stored.price_entries] == [12_500]
    assert _raw(engine, "SELECT list_price FROM price_entry") == [(_stored(12_500, money_scale),)]


def test_a_sale_is_stored_at_the_business_scale_and_the_repository_reads_it_back(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    product_id = _product(client)

    sale = _sell(client, product_id, shipping_charged=1_500)

    assert sale["shipping_charged"] == 1_500
    assert sale["total"] == 23_500
    assert _raw(engine, "SELECT shipping_charged FROM sale") == [(_stored(1_500, money_scale),)]
    assert _raw(engine, "SELECT price_per_gram, line_total FROM sale_line") == [
        (_stored(11_000, money_scale), _stored(22_000, money_scale))
    ]
    assert _raw(engine, "SELECT amount FROM payment") == [(_stored(23_500, money_scale),)]
    with Session(engine) as session:
        view = SqlSales(session, _business_id(engine)).get_view(sale["id"])
    assert view is not None
    assert view.sale.shipping_charged == 1_500
    assert [line.line.line_total for line in view.lines] == [22_000]
    assert view.sale.payment is not None and view.sale.payment.amount == 23_500


def test_the_sales_ledger_sums_in_whole_units_at_both_scales(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    from app.sales.adapters.sales_ledger import SqlSalesLedger

    _sell(client, _product(client), shipping_charged=1_500)

    with Session(engine) as session:
        (record,) = SqlSalesLedger(session, _business_id(engine)).all()

    assert (record.shipping, record.total) == (1_500, 23_500)


CATALOG_TEXT = (
    "\U0001f33f **CATALOG** \U0001f33f\n\n**Lavanda**\n"
    "\u2022 Price per gram: $11.000\n\u2022 From 5 g: $9.000 each\n\n"
    "\U0001f4e9 Questions and orders by private message."
)
BILL = {
    "business_name": "Primer Negocio",
    "number": 1,
    "date": DAY,
    "shipping_charged": 1_500,
    "total": 46_500,
    "lines": [
        {
            "product": "Lavanda",
            "quantity": 5.0,
            "amount": 45_000,
            "rule": "bulk",
            "unit_price": 9_000,
        }
    ],
    "payment": {"state": "cash", "still_owed": None},
    "balance": None,
}


def _stocked_bulk_product(client: TestClient) -> int:
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True})
    product_id = _product(client, bulk_price=9_000, bulk_minimum="5")
    client.post(
        "/stock/entries",
        json={"product_id": product_id, "origin": "opening_stock", "quantity": "50"},
    )
    return product_id


def test_the_catalog_text_and_its_prices_are_the_same_at_both_scales(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    _stocked_bulk_product(client)

    with Session(engine) as session:
        (shown,) = SqlCatalogVarieties(session, _business_id(engine)).on(date(2026, 10, 2))

    assert shown.price == CatalogPrice(
        list_price=11_000, bulk_price=9_000, bulk_minimum=Quantity.of("5")
    )
    assert client.get("/catalog").json()["text"] == CATALOG_TEXT


def test_the_sale_bill_and_the_sale_list_are_the_same_at_both_scales(
    client: TestClient, money_scale: int
) -> None:
    product_id = _stocked_bulk_product(client)
    customer = client.post("/customers", json={"name": "Juana", "phone": "11 1000-0000"}).json()
    created = _sell(
        client,
        product_id,
        customer_id=customer["id"],
        shipping_charged=1_500,
        lines=[{"product_id": product_id, "quantity": "5"}],
    )

    assert client.get(f"/sales/{created['id']}").json()["bill"] == BILL
    assert [(s["total"], s["shipping_charged"]) for s in client.get("/sales").json()] == [
        (46_500, 1_500)
    ]


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
    client: TestClient, engine: Engine, field: str
) -> None:
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


def _owing_sale(client: TestClient, product_id: int) -> dict[str, Any]:
    customer = client.post("/customers", json={"name": "Juana", "phone": "11 1000-0000"}).json()
    return _sell(
        client,
        product_id,
        customer_id=customer["id"],
        payment="owing",
        shipping_charged=1_500,
        lines=[{"product_id": product_id, "quantity": "5"}],
    )


def test_money_on_every_converted_route_is_a_json_integer(client: TestClient) -> None:
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True})
    product_id = _product(client, bulk_price=9_000, bulk_minimum="5", vip_price=8_000)
    client.post(
        "/stock/entries",
        json={"product_id": product_id, "origin": "opening_stock", "quantity": "50"},
    )

    created = _owing_sale(client, product_id)
    detail = client.get(f"/sales/{created['id']}").json()
    listed = client.get("/sales").json()
    prices = client.get(f"/api/products/{product_id}/prices").json()

    sale_fields = ("shipping_charged", "total", "lines[].price_per_gram", "lines[].line_total")
    assert_money_is_int(created, *sale_fields)
    assert_money_is_int({"sales": listed}, "sales[].shipping_charged", "sales[].total")
    assert_money_is_int(
        detail,
        *sale_fields,
        "lines[].cost.costed",
        "bill.shipping_charged",
        "bill.total",
        "bill.lines[].amount",
        "bill.lines[].unit_price",
        "bill.payment.still_owed",
        "bill.balance",
    )
    assert_money_is_int({"entries": prices}, "entries[].list_price", "entries[].bulk_price")
    assert_money_is_int({"entries": prices}, "entries[].vip_price")


@pytest.mark.parametrize(
    "where",
    ["shipping_charged", "special_price", "list_price", "bulk_price", "vip_price"],
)
def test_a_money_field_with_a_decimal_is_refused_over_http_and_nothing_is_saved(
    client: TestClient, engine: Engine, where: str
) -> None:
    client.put("/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True})
    product_id = _product(client)
    sales_before = _raw(engine, "SELECT count(*) FROM sale")
    entries_before = _raw(engine, "SELECT count(*) FROM price_entry")
    if where in ("shipping_charged", "special_price"):
        line: dict[str, Any] = {"product_id": product_id, "quantity": "2"}
        if where == "special_price":
            line["special_price"] = 10.5
        refused = client.post(
            "/sales",
            json={
                "lines": [line],
                "payment": {"kind": "paid", "payment_method_id": 1},
                "date": DAY,
                **({"shipping_charged": 10.5} if where == "shipping_charged" else {}),
            },
        )
    else:
        refused = client.post(
            f"/api/products/{product_id}/prices",
            json={
                "effective_from": "2026-02-01",
                "list_price": 10.5 if where == "list_price" else 11_000,
                "bulk_price": 10.5 if where == "bulk_price" else 9_000,
                "bulk_minimum": "5",
                "vip_price": 10.5 if where == "vip_price" else 8_000,
            },
        )

    assert refused.status_code == 422, refused.text
    assert refused.json() == {
        "detail": "the amount has more decimals than the business allows",
        "code": "money.too_many_decimals",
    }
    assert _raw(engine, "SELECT count(*) FROM sale") == sales_before
    assert _raw(engine, "SELECT count(*) FROM price_entry") == entries_before


def test_a_whole_amount_written_with_a_decimal_point_is_accepted(client: TestClient) -> None:
    product_id = _product(client)

    sale = _sell(client, product_id, shipping_charged=1_500.0)

    assert sale["shipping_charged"] == 1_500


@pytest.mark.parametrize(
    ("body", "path"),
    [
        ({"total": 11_000.0}, "total"),
        ({"total": "11000"}, "total"),
        ({"total": True}, "total"),
        ({"total": 11_000}, "balance"),
        ({"lines": [{"cost": {"costed": None}}]}, "lines[].cost.costed"),
        ({"lines": []}, "lines[].line_total"),
        ({"lines": [{"line_total": 1}, {"line_total": 2.5}]}, "lines[].line_total"),
    ],
)
def test_the_money_wire_helper_rejects_what_is_not_a_json_integer(
    body: dict[str, Any], path: str
) -> None:
    with pytest.raises(AssertionError):
        assert_money_is_int(body, path)


def test_the_money_wire_helper_accepts_integers_and_a_listed_null() -> None:
    body = {"total": 11_000, "lines": [{"cost": {"costed": None}}]}

    assert_money_is_int(body, "total")
    assert_money_is_int(body, "lines[].cost.costed", null_ok=("lines[].cost.costed",))
