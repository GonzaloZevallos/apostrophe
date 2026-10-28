"""`SalesImport` over a real database (the plan's invariant: a sale is priced with
vip = (row type is "Amigo"), never from the customer's stored VIP flag; every quote,
in the plan or the write, comes from `Variety.current_price` through sales' `_quote`).

A business comes from the `client` fixture over HTTP (CODING_STANDARDS section 5);
only `SalesImport` and `VarietiesImport`, the seams under test, are built and called
directly.
"""

from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow
from app.sales.adapters.import_port import SalesImport
from app.sales.adapters.price_book import PlannedPriceBook
from app.sales.adapters.sql_sales import SqlSales
from app.sales.domain.pricing import price_line
from app.shared.quantity import Quantity
from app.shared.pricing_settings import PricingSettings
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.ports import Refusal, SaleCheck, SaleCheckInput
from app.spreadsheet_import.domain.plan import OnTheSpotMethod
from app.spreadsheet_import.domain.rows import PriceHistoryRow, SheetRef
from app.varieties.adapters.import_port import VarietiesImport

BOTH_ON = PricingSettings(is_bulk_pricing=True, is_vip_customers=True)
TODAY = date(2026, 6, 15)
ONE_GRAM = Quantity.of(1)


def _business_id(engine: Engine, email: str) -> int:
    with Session(engine) as session:
        row = session.scalar(select(UserRow).where(UserRow.email == email))
        assert row is not None
        return row.business_id


def _customer_id(client: TestClient, phone: str = "11 2345-6789") -> int:
    body: dict[str, int] = client.post(
        "/customers", json={"name": "Fran Araujo", "phone": phone}
    ).json()
    return body["id"]


def _price_row(
    *,
    effective: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Quantity | None = None,
    variety: str = "Blue Dream",
) -> PriceHistoryRow:
    return PriceHistoryRow(
        ref=SheetRef(sheet="Ajustes", row=37),
        variety=variety,
        effective=effective,
        list_price=list_price,
        bulk_price=bulk_price,
        bulk_minimum=bulk_minimum,
    )


def _sale_input(
    *,
    variety_key: str = "blue dream",
    quantity: Quantity = ONE_GRAM,
    has_customer: bool = False,
    vip: bool = False,
    gift: bool = False,
    special_total: int | None = None,
    shipping: int = 0,
    method: OnTheSpotMethod | None = "cash",
    left_owing: bool = False,
    sale_date: date = TODAY,
) -> SaleCheckInput:
    return SaleCheckInput(
        variety_key=variety_key,
        quantity=quantity,
        has_customer=has_customer,
        vip=vip,
        gift=gift,
        special_total=special_total,
        shipping=shipping,
        method=method,
        left_owing=left_owing,
        sale_date=sale_date,
        note=None,
    )


def test_has_records_is_false_for_a_fresh_business_true_after_write(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)
        assert sales_import.has_records() is False

        varieties_import = VarietiesImport(session, business_id)
        variety_id = varieties_import.write_variety("Blue Dream", NoCommit())
        varieties_import.write_price_entry(
            variety_id,
            _price_row(effective=date(2026, 1, 1), list_price=1_000),
            NoCommit(),
        )
        sale = _sale_input()
        sales_import.write_sale(
            variety_id,
            None,
            sale,
            datetime(2026, 6, 15, 12, tzinfo=UTC),
            TODAY,
            NoCommit(),
            BOTH_ON,
        )
        session.commit()

        assert sales_import.has_records() is True


def test_check_sales_refuses_a_row_with_no_price_that_day(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)
        results = sales_import.check_sales(
            price_history=[],
            variety_keys={},
            sales=[_sale_input()],
            today=TODAY,
            settings=BOTH_ON,
        )

    assert len(results) == 1
    assert isinstance(results[0], SaleCheck)
    assert results[0].total is None
    assert isinstance(results[0].refusal, Refusal)
    assert results[0].refusal.code == "sale.no_price_that_day"


def test_check_sales_refuses_a_gift_with_a_special_total(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    history = [_price_row(effective=date(2026, 1, 1), list_price=1_000)]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)
        results = sales_import.check_sales(
            price_history=history,
            variety_keys=keys,
            sales=[_sale_input(gift=True, special_total=500, method=None)],
            today=TODAY,
            settings=BOTH_ON,
        )

    assert results[0].refusal is not None
    assert results[0].refusal.code == "sale.gift_with_special_price"


def test_check_sales_prices_list_bulk_and_vip_falling_back_to_list(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    history = [
        _price_row(
            effective=date(2026, 1, 1), list_price=1_000, bulk_price=800, bulk_minimum=Quantity.of(10)
        ),
        _price_row(effective=date(2026, 7, 1), list_price=1_000, variety="Blue Dream"),
    ]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)

        lista_bulk = _sale_input(
            has_customer=True, quantity=Quantity.of(20), sale_date=date(2026, 6, 1)
        )
        lista_under_minimum = _sale_input(
            has_customer=True, quantity=Quantity.of(1), sale_date=date(2026, 6, 1)
        )
        amigo_no_bulk_that_day = _sale_input(
            has_customer=True, vip=True, quantity=Quantity.of(1), sale_date=date(2026, 7, 15)
        )

        results = sales_import.check_sales(
            price_history=history,
            variety_keys=keys,
            sales=[lista_bulk, lista_under_minimum, amigo_no_bulk_that_day],
            today=date(2026, 7, 31),
            settings=BOTH_ON,
        )

    assert results[0].total == 16_000  # 20g at the bulk price of 800
    assert results[1].total == 1_000  # under the bulk minimum: list price
    assert results[2].total == 1_000  # Amigo, no bulk that day: falls back to list


def test_planned_price_book_agrees_with_the_sql_book_once_written(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    history = [
        _price_row(
            effective=date(2026, 1, 1), list_price=1_000, bulk_price=600, bulk_minimum=Quantity.of(10)
        )
    ]
    keys = {"Blue Dream": "blue dream"}
    sale = _sale_input(
        has_customer=True, quantity=Quantity.of(20), sale_date=date(2026, 6, 1), method="transfer"
    )

    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)
        planned = sales_import.check_sales(
            price_history=history, variety_keys=keys, sales=[sale], today=TODAY, settings=BOTH_ON
        )
        assert planned[0].refusal is None
        planned_total = planned[0].total

        varieties_import = VarietiesImport(session, business_id)
        variety_id = varieties_import.write_variety("Blue Dream", NoCommit())
        varieties_import.write_price_entry(variety_id, history[0], NoCommit())
        written_total = sales_import.write_sale(
            variety_id,
            None,
            sale,
            datetime(2026, 6, 1, 12, tzinfo=UTC),
            TODAY,
            NoCommit(),
            BOTH_ON,
        )
        session.commit()

    assert planned_total == written_total == 12_000  # 20g at the bulk price of 600


def test_write_sale_stores_the_pricing_rule_from_the_row_s_own_vip_fact(
    client: TestClient, engine: Engine
) -> None:
    """`write_sale` must price a row from `sale.vip` alone (the plan's invariant),
    never from a stored customer flag: an Amigo row on a day with a bulk price is
    stored as `vip`, not `bulk`, and an Amigo row on a day with none still falls back
    to `list` — the same matrix the brief asks `check_sales` to prove, now proven
    again at the write."""
    business_id = _business_id(engine, "uno@example.com")
    customer_id = _customer_id(client)
    run_today = date(2026, 8, 1)
    with Session(engine) as session:
        varieties_import = VarietiesImport(session, business_id)
        variety_id = varieties_import.write_variety("Blue Dream", NoCommit())
        varieties_import.write_price_entry(
            variety_id,
            _price_row(
                effective=date(2026, 1, 1),
                list_price=1_000,
                bulk_price=800,
                bulk_minimum=Quantity.of(10),
            ),
            NoCommit(),
        )
        varieties_import.write_price_entry(
            variety_id,
            _price_row(effective=date(2026, 7, 1), list_price=1_000),
            NoCommit(),
        )
        session.commit()

        sales_import = SalesImport(session, business_id)
        bulk_date = date(2026, 6, 1)
        list_date = date(2026, 6, 2)
        amigo_fallback_date = date(2026, 7, 15)
        vip_date = date(2026, 6, 3)
        cases = [
            (bulk_date, _sale_input(has_customer=True, quantity=Quantity.of(20), sale_date=bulk_date)),
            (list_date, _sale_input(has_customer=True, quantity=Quantity.of(1), sale_date=list_date)),
            (
                amigo_fallback_date,
                _sale_input(
                    has_customer=True, vip=True, quantity=Quantity.of(1), sale_date=amigo_fallback_date
                ),
            ),
            (
                vip_date,
                _sale_input(
                    has_customer=True, vip=True, quantity=Quantity.of(20), sale_date=vip_date
                ),
            ),
        ]
        for sale_date, sale in cases:
            sales_import.write_sale(
                variety_id,
                customer_id,
                sale,
                datetime(sale_date.year, sale_date.month, sale_date.day, 12, tzinfo=UTC),
                run_today,
                NoCommit(),
                BOTH_ON,
            )
        session.commit()

        sales = SqlSales(session, business_id).list(date_from=None, date_to=None)

    by_date = {sale.date: sale for sale in sales}

    bulk_line = by_date[date(2026, 6, 1)].lines[0]
    assert bulk_line.pricing_rule.value == "bulk"
    assert bulk_line.price_per_gram == 800

    list_line = by_date[date(2026, 6, 2)].lines[0]
    assert list_line.pricing_rule.value == "list"
    assert list_line.price_per_gram == 1_000

    amigo_fallback_line = by_date[date(2026, 7, 15)].lines[0]
    assert amigo_fallback_line.pricing_rule.value == "list"
    assert amigo_fallback_line.price_per_gram == 1_000

    vip_line = by_date[date(2026, 6, 3)].lines[0]
    assert vip_line.pricing_rule.value == "vip"
    assert vip_line.price_per_gram == 800


def test_planned_price_book_matches_what_write_sale_stores_for_bulk_list_vip_and_gift(
    client: TestClient, engine: Engine
) -> None:
    """The planned side and the written side must agree line by line, not only on
    the sale's total: for each sale, the stored line's rule, price per gram and
    total equal what `price_line` computes from the exact quote `PlannedPriceBook`
    answers for that variety and day."""
    business_id = _business_id(engine, "uno@example.com")
    customer_id = _customer_id(client)
    run_today = date(2026, 8, 1)
    history = [
        _price_row(
            effective=date(2026, 1, 1), list_price=1_000, bulk_price=800, bulk_minimum=Quantity.of(10)
        )
    ]
    keys = {"Blue Dream": "blue dream"}
    ordinals = {"blue dream": 1}

    bulk_sale = _sale_input(has_customer=True, quantity=Quantity.of(20), sale_date=date(2026, 6, 1))
    list_sale = _sale_input(has_customer=True, quantity=Quantity.of(1), sale_date=date(2026, 6, 2))
    vip_sale = _sale_input(
        has_customer=True, vip=True, quantity=Quantity.of(20), sale_date=date(2026, 6, 3)
    )
    gift_sale = _sale_input(gift=True, quantity=Quantity.of(5), sale_date=date(2026, 6, 4), method=None)
    cases = [bulk_sale, list_sale, vip_sale, gift_sale]

    book = PlannedPriceBook(history, keys, ordinals)
    expected = []
    for sale in cases:
        pricing = book.for_variety(1, sale.sale_date)
        quote = pricing.current if pricing is not None else None
        expected.append(
            price_line(
                gift=sale.gift,
                special_price=sale.special_total,
                customer_is_vip=sale.vip,
                settings=BOTH_ON,
                quote=quote,
                quantity=sale.quantity,
            )
        )

    with Session(engine) as session:
        varieties_import = VarietiesImport(session, business_id)
        variety_id = varieties_import.write_variety("Blue Dream", NoCommit())
        varieties_import.write_price_entry(variety_id, history[0], NoCommit())
        session.commit()

        sales_import = SalesImport(session, business_id)
        for sale in cases:
            given_customer_id = customer_id if sale.has_customer else None
            sales_import.write_sale(
                variety_id,
                given_customer_id,
                sale,
                datetime(
                    sale.sale_date.year, sale.sale_date.month, sale.sale_date.day, 12, tzinfo=UTC
                ),
                run_today,
                NoCommit(),
                BOTH_ON,
            )
        session.commit()

        sales = SqlSales(session, business_id).list(date_from=None, date_to=None)

    by_date = {sale.date: sale for sale in sales}
    for sale, exp in zip(cases, expected, strict=True):
        stored = by_date[sale.sale_date]
        line = stored.lines[0]
        assert line.pricing_rule == exp.rule
        assert line.price_per_gram == exp.price_per_gram
        assert line.line_total == exp.line_total
        assert stored.total == exp.line_total + sale.shipping
