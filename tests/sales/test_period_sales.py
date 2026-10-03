"""`SqlPeriodSales.summaries` (results' `PeriodSales` port): a variety and the sales
come over the `client` fixture (CODING_STANDARDS section 5); only `SqlPeriodSales`
itself, the seam under test, is built and called directly."""

from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.results.application.ports import SalesSummary
from app.results.domain.periods import Period, periods
from app.sales.adapters.period_sales import SqlPeriodSales
from app.sales.adapters.sql_sales import SqlSales
from app.sales.domain.pricing import PriceQuote
from app.sales.domain.sale import LineRequest, PaymentMethod, Sale
from app.shared.grams import Grams
from app.varieties.adapters.tables import VarietyRow

TODAY = date(2026, 6, 15)
RECORDED_AT = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)
QUOTE = PriceQuote(list_price=1_000)
ONE_GRAM = Grams.of(1)


def _variety_id(client: TestClient) -> int:
    body: dict[str, int] = client.post("/varieties", json={"name": "Blue Dream"}).json()
    return body["id"]


def _business_id_of_variety(engine: Engine, variety_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(VarietyRow).where(VarietyRow.id == variety_id))
        assert row is not None
        return row.business_id


def _sale(*, variety_id: int, sale_date: date) -> Sale:
    return Sale.record(
        sale_date=sale_date,
        today=sale_date,
        customer_id=None,
        customer=None,
        shipping_charged=0,
        note=None,
        lines=[LineRequest(variety_id=variety_id, grams=ONE_GRAM, quote=QUOTE)],
        method=PaymentMethod.CASH,
        left_owing=False,
        recorded_at=RECORDED_AT,
    )


def test_summaries_splits_sales_into_their_own_period_each(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    the_periods = periods(TODAY)
    # One sale today, one later the same week (TODAY is the week's Monday), one in
    # the previous month.
    day_later_in_week = the_periods.week.end
    day_in_previous_month = the_periods.month.start - timedelta(days=5)
    sales.add(_sale(variety_id=variety_id, sale_date=TODAY))
    sales.add(_sale(variety_id=variety_id, sale_date=day_later_in_week))
    sales.add(_sale(variety_id=variety_id, sale_date=day_in_previous_month))

    period_sales = SqlPeriodSales(Session(engine), business_id)
    today_period = the_periods.today
    week_period = the_periods.week
    month_period = the_periods.month

    answer = period_sales.summaries([today_period, week_period, month_period])

    assert answer[today_period] == SalesSummary(
        total=1_000, count=1, grams_sold=ONE_GRAM, grams_gifted=Grams(0)
    )
    assert answer[week_period] == SalesSummary(
        total=2_000, count=2, grams_sold=ONE_GRAM + ONE_GRAM, grams_gifted=Grams(0)
    )
    assert answer[month_period] == SalesSummary(
        total=2_000, count=2, grams_sold=ONE_GRAM + ONE_GRAM, grams_gifted=Grams(0)
    )


def test_summaries_reads_exactly_two_statements_whatever_the_number_of_periods(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    sales = SqlSales(Session(engine), business_id)
    sales.add(_sale(variety_id=variety_id, sale_date=date(2026, 6, 15)))

    period_sales = SqlPeriodSales(Session(engine), business_id)
    periods = [
        Period(date(2026, 6, 15), date(2026, 6, 15)),
        Period(date(2026, 6, 15), date(2026, 6, 21)),
        Period(date(2026, 6, 1), date(2026, 6, 30)),
    ]

    statements: list[str] = []

    def _record(
        conn: object, cursor: object, statement: str, parameters: object, *args: object
    ) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", _record)
    try:
        period_sales.summaries(periods)
    finally:
        event.remove(engine, "before_cursor_execute", _record)

    assert len(statements) == 2, statements


def test_an_empty_business_summarises_to_zero_for_every_period(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)
    business_id = _business_id_of_variety(engine, variety_id)
    period_sales = SqlPeriodSales(Session(engine), business_id)
    period = Period(date(2026, 6, 15), date(2026, 6, 15))

    answer = period_sales.summaries([period])

    assert answer[period] == SalesSummary(
        total=0, count=0, grams_sold=Grams(0), grams_gifted=Grams(0)
    )
