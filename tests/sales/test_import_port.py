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
from app.shared.grams import Grams
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.ports import Refusal, SaleCheck, SaleCheckInput
from app.spreadsheet_import.domain.rows import PriceHistoryRow, SheetRef
from app.varieties.adapters.import_port import VarietiesImport

TODAY = date(2026, 6, 15)
ONE_GRAM = Grams.of(1)


def _business_id(engine: Engine, email: str) -> int:
    with Session(engine) as session:
        row = session.scalar(select(UserRow).where(UserRow.email == email))
        assert row is not None
        return row.business_id


def _price_row(
    *,
    effective: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Grams | None = None,
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
    grams: Grams = ONE_GRAM,
    has_customer: bool = False,
    vip: bool = False,
    gift: bool = False,
    special_total: int | None = None,
    shipping: int = 0,
    method: str | None = "cash",
    left_owing: bool = False,
    sale_date: date = TODAY,
) -> SaleCheckInput:
    return SaleCheckInput(
        variety_key=variety_key,
        grams=grams,
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
            variety_id, None, sale, datetime(2026, 6, 15, 12, tzinfo=UTC), TODAY, NoCommit()
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
        )

    assert results[0].refusal is not None
    assert results[0].refusal.code == "sale.gift_with_special_price"


def test_check_sales_prices_list_bulk_and_vip_falling_back_to_list(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    history = [
        _price_row(
            effective=date(2026, 1, 1), list_price=1_000, bulk_price=800, bulk_minimum=Grams.of(10)
        ),
        _price_row(effective=date(2026, 7, 1), list_price=1_000, variety="Blue Dream"),
    ]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)

        lista_bulk = _sale_input(
            has_customer=True, grams=Grams.of(20), sale_date=date(2026, 6, 1)
        )
        lista_under_minimum = _sale_input(
            has_customer=True, grams=Grams.of(1), sale_date=date(2026, 6, 1)
        )
        amigo_no_bulk_that_day = _sale_input(
            has_customer=True, vip=True, grams=Grams.of(1), sale_date=date(2026, 7, 15)
        )

        results = sales_import.check_sales(
            price_history=history,
            variety_keys=keys,
            sales=[lista_bulk, lista_under_minimum, amigo_no_bulk_that_day],
            today=date(2026, 7, 31),
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
            effective=date(2026, 1, 1), list_price=1_000, bulk_price=600, bulk_minimum=Grams.of(10)
        )
    ]
    keys = {"Blue Dream": "blue dream"}
    sale = _sale_input(
        has_customer=True, grams=Grams.of(20), sale_date=date(2026, 6, 1), method="transfer"
    )

    with Session(engine) as session:
        sales_import = SalesImport(session, business_id)
        planned = sales_import.check_sales(
            price_history=history, variety_keys=keys, sales=[sale], today=TODAY
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
        )
        session.commit()

    assert planned_total == written_total == 12_000  # 20g at the bulk price of 600
