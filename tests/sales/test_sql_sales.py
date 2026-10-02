"""`SqlSales` over a real database (CODING_STANDARDS section 9, ADR-0004, ADR-0006):
every statement filters on its business, `customer_id` on `sale` and `payment` is
written only by `add` and by `assign_customer`'s guarded updates, and `delete` removes
the lines and the payment explicitly.

A variety and a customer come from the `client` fixture over HTTP (CODING_STANDARDS
section 5); only `SqlSales` itself, the seam under test, is built and called directly.
"""

from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.sales.adapters.sql_sales import SqlSales
from app.sales.domain.pricing import PriceQuote, PricingRule
from app.sales.domain.sale import CustomerAlreadyAssigned, LineRequest, PaymentMethod, Sale
from app.shared.grams import Grams
from app.varieties.adapters.tables import VarietyRow

TODAY = date(2026, 6, 15)
RECORDED_AT = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)
QUOTE = PriceQuote(list_price=1_000)
ONE_GRAM = Grams.of(1)


def _variety_id(client: TestClient) -> int:
    body: dict[str, int] = client.post("/varieties", json={"name": "Blue Dream"}).json()
    return body["id"]


def _customer_id(client: TestClient, phone: str = "11 2345-6789") -> int:
    body: dict[str, int] = client.post(
        "/customers", json={"name": "Fran Araujo", "phone": phone}
    ).json()
    return body["id"]


def _business_id_of_variety(engine: Engine, variety_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(VarietyRow).where(VarietyRow.id == variety_id))
        assert row is not None
        return row.business_id


def _business_id_of_customer(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(CustomerRow).where(CustomerRow.id == customer_id))
        assert row is not None
        return row.business_id


def _sale(
    *,
    variety_id: int,
    customer_id: int | None = None,
    sale_date: date = TODAY,
    method: PaymentMethod | None = PaymentMethod.CASH,
    left_owing: bool = False,
    grams: Grams = ONE_GRAM,
) -> Sale:
    return Sale.record(
        sale_date=sale_date,
        today=TODAY,
        customer_id=customer_id,
        customer=None,
        shipping_charged=100,
        note="a note",
        lines=[LineRequest(variety_id=variety_id, grams=grams, quote=QUOTE)],
        method=method,
        left_owing=left_owing,
        recorded_at=RECORDED_AT,
    )


def test_add_then_get_round_trips_a_sale_with_its_lines_and_payment(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    customer_id = _customer_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sale = _sale(variety_id=variety_id, customer_id=customer_id)

    stored = sales.add(sale)

    assert stored.id is not None
    fetched = sales.get(stored.id)
    assert fetched is not None
    assert fetched.date == TODAY
    assert fetched.customer_id == customer_id
    assert fetched.shipping_charged == 100
    assert fetched.note == "a note"
    assert fetched.total == stored.total
    assert len(fetched.lines) == 1
    line = fetched.lines[0]
    assert line.variety_id == variety_id
    assert line.pricing_rule == PricingRule.LIST
    assert line.price_per_gram == 1_000
    assert line.line_total == 1_000
    assert fetched.payment is not None
    assert fetched.payment.amount == fetched.total
    assert fetched.payment.method == PaymentMethod.CASH
    assert fetched.payment.customer_id == customer_id


def test_a_sale_without_a_customer_stores_none_and_has_no_payment_customer(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sale = _sale(variety_id=variety_id, customer_id=None)

    stored = sales.add(sale)
    fetched = sales.get(stored.id) if stored.id is not None else None

    assert fetched is not None
    assert fetched.customer_id is None
    assert fetched.payment is not None
    assert fetched.payment.customer_id is None


def test_list_orders_by_sale_date_desc_then_id_desc(client: TestClient, engine: Engine) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    first = sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 6, 1)))
    second = sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 6, 10)))
    third = sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 6, 10)))

    ids = [s.id for s in sales.list(None, None)]

    assert ids == [third.id, second.id, first.id]


def test_list_filters_by_an_inclusive_date_range_and_an_inverted_range_is_empty(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 5, 1)))
    middle = sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 5, 10)))
    sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 5, 20)))

    in_range = sales.list(date(2026, 5, 5), date(2026, 5, 15))
    inverted = sales.list(date(2026, 5, 15), date(2026, 5, 5))

    assert [s.id for s in in_range] == [middle.id]
    assert inverted == []


def test_a_sale_of_another_business_is_not_returned_by_get_or_list(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    other_variety_id = _variety_id(other_client)
    other_business_id = _business_id_of_variety(engine, other_variety_id)
    sales = SqlSales(Session(engine), business_id)
    other_sales = SqlSales(Session(engine), other_business_id)
    sale_id = sales.add(_sale(variety_id=variety_id)).id
    assert sale_id is not None

    assert other_sales.get(sale_id) is None
    assert other_sales.list(None, None) == []


def test_assign_customer_sets_it_on_the_sale_and_its_payment(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    customer_id = _customer_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sale_id = sales.add(_sale(variety_id=variety_id, customer_id=None)).id
    assert sale_id is not None

    sales.assign_customer(sale_id, customer_id)

    fetched = sales.get(sale_id)
    assert fetched is not None
    assert fetched.customer_id == customer_id
    assert fetched.payment is not None
    assert fetched.payment.customer_id == customer_id


def test_assign_customer_a_second_time_is_refused_and_never_replaces_the_first(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    first_customer_id = _customer_id(client, "11 2345-6789")
    second_customer_id = _customer_id(client, "11 9876-5432")
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sale_id = sales.add(_sale(variety_id=variety_id, customer_id=None)).id
    assert sale_id is not None
    sales.assign_customer(sale_id, first_customer_id)

    try:
        sales.assign_customer(sale_id, second_customer_id)
    except CustomerAlreadyAssigned:
        pass
    else:
        raise AssertionError("expected CustomerAlreadyAssigned")

    fetched = sales.get(sale_id)
    assert fetched is not None
    assert fetched.customer_id == first_customer_id


def test_delete_removes_the_sale_its_lines_and_its_payment(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sale_id = sales.add(_sale(variety_id=variety_id)).id
    assert sale_id is not None

    sales.delete(sale_id)

    assert sales.get(sale_id) is None
    assert sales.list(None, None) == []
