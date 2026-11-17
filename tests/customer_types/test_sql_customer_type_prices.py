"""`SqlCustomerTypePrices` over a real database, and `DELETE /api/customer-types/{id}` taking
the type's rows with it. Businesses, products and types come over HTTP; only the repository
under test goes straight to the adapter."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customer_types.adapters.sql_customer_type_prices import SqlCustomerTypePrices
from app.customer_types.adapters.tables import CustomerTypePriceRow, CustomerTypeRow
from app.customers.adapters.tables import CustomerRow

DAY = date(2026, 1, 1)


def _product_with_entry(client: TestClient, name: str) -> tuple[int, int]:
    product = client.post("/api/products", json={"name": name}).json()["id"]
    entry = client.post(
        f"/api/products/{product}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    ).json()["id"]
    return product, entry


def _type(client: TestClient, name: str) -> int:
    return int(client.post("/api/customer-types", json={"name": name}).json()["id"])


def _business_of(engine: Engine, type_id: int) -> int:
    with Session(engine) as session:
        row = session.get(CustomerTypeRow, type_id)
        assert row is not None
        return row.business_id


def _rows(engine: Engine) -> list[tuple[int, int, int | None]]:
    with Session(engine) as session:
        return [
            (row.customer_type_id, row.variety_id, row.price_entry_id)
            for row in session.scalars(
                select(CustomerTypePriceRow).order_by(CustomerTypePriceRow.id)
            )
        ]


def test_a_price_is_read_back_in_whole_units_by_entry_and_by_type(
    client: TestClient, engine: Engine
) -> None:
    product, entry = _product_with_entry(client, "Lavanda")
    gold, silver = _type(client, "Gold"), _type(client, "Silver")
    business = _business_of(engine, gold)

    with Session(engine) as session:
        prices = SqlCustomerTypePrices(session, business)
        prices.add(gold, product, DAY, 9_000, entry)
        prices.add(silver, product, DAY, 8_000, entry)
        session.commit()

    with Session(engine) as session:
        prices = SqlCustomerTypePrices(session, business)
        assert prices.tied_price(entry, gold) == 9_000
        assert prices.tied_price(entry, silver) == 8_000
        assert prices.tied_price(entry + 1, gold) is None
        assert prices.prices_of_type(gold, [entry, entry + 1]) == {entry: 9_000}
        assert prices.prices_of_type(gold, []) == {}


def test_removing_by_entry_by_product_and_by_type_takes_only_what_it_names(
    client: TestClient, engine: Engine
) -> None:
    first, first_entry = _product_with_entry(client, "Lavanda")
    second, second_entry = _product_with_entry(client, "Menta")
    gold, silver = _type(client, "Gold"), _type(client, "Silver")
    business = _business_of(engine, gold)
    with Session(engine) as session:
        prices = SqlCustomerTypePrices(session, business)
        prices.add(gold, first, DAY, 9_000, first_entry)
        prices.add(gold, second, DAY, 9_100, second_entry)
        prices.add(silver, first, DAY, 8_000, first_entry)
        prices.add(silver, second, DAY, 8_100, second_entry)
        session.commit()

    with Session(engine) as session:
        SqlCustomerTypePrices(session, business).remove_for_entry(first_entry)
        session.commit()
    assert _rows(engine) == [(gold, second, second_entry), (silver, second, second_entry)]

    with Session(engine) as session:
        SqlCustomerTypePrices(session, business).remove_for_type(silver)
        session.commit()
    assert _rows(engine) == [(gold, second, second_entry)]

    with Session(engine) as session:
        SqlCustomerTypePrices(session, business).remove_for_product(second)
        session.commit()
    assert _rows(engine) == []


def test_another_business_reads_and_removes_none_of_the_rows(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    product, entry = _product_with_entry(client, "Lavanda")
    mine = _type(client, "Gold")
    theirs = _type(other_client, "Other")
    with Session(engine) as session:
        SqlCustomerTypePrices(session, _business_of(engine, mine)).add(
            mine, product, DAY, 9_000, entry
        )
        session.commit()

    with Session(engine) as session:
        strangers = SqlCustomerTypePrices(session, _business_of(engine, theirs))
        assert strangers.tied_price(entry, mine) is None
        assert strangers.prices_of_type(mine, [entry]) == {}
        strangers.remove_for_entry(entry)
        strangers.remove_for_product(product)
        strangers.remove_for_type(mine)
        session.commit()

    assert _rows(engine) == [(mine, product, entry)]


def test_deleting_a_type_without_customers_deletes_its_rows(
    client: TestClient, engine: Engine
) -> None:
    product, entry = _product_with_entry(client, "Lavanda")
    gone, kept = _type(client, "Gone"), _type(client, "Kept")
    business = _business_of(engine, gone)
    with Session(engine) as session:
        prices = SqlCustomerTypePrices(session, business)
        prices.add(gone, product, DAY, 9_000, entry)
        prices.add(kept, product, DAY, 8_000, entry)
        session.commit()

    assert client.delete(f"/api/customer-types/{gone}").status_code == 204

    assert _rows(engine) == [(kept, product, entry)]


def test_deleting_a_type_with_customers_is_refused_and_keeps_its_rows(
    client: TestClient, engine: Engine
) -> None:
    product, entry = _product_with_entry(client, "Lavanda")
    used = _type(client, "Used")
    business = _business_of(engine, used)
    with Session(engine) as session:
        SqlCustomerTypePrices(session, business).add(used, product, DAY, 9_000, entry)
        session.add(CustomerRow(business_id=business, name="Member", customer_type_id=used))
        session.commit()

    refused = client.delete(f"/api/customer-types/{used}")

    assert refused.status_code == 409
    assert _rows(engine) == [(used, product, entry)]
