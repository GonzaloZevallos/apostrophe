"""`customer_sales` (domain unit test, no infrastructure): a Customer's monthly Sale
totals and Average sale over the last `SALES_BY_MONTH_WINDOW` months, checked against a
direct calculation."""

from __future__ import annotations

from datetime import date

from app.payments.domain.customer_sales import SALES_BY_MONTH_WINDOW, customer_sales
from app.payments.domain.settlement import OwedSale
from app.shared.average import average_sale
from app.shared.calendar import Month
from tests.payments.builders import owed_sale

TODAY = date(2026, 11, 21)
# The window for TODAY: June to November 2026.
FIRST_DAY = date(2026, 6, 1)


def direct(sales: list[OwedSale], today: date) -> tuple[dict[str, int], int | None]:
    """The by-hand sum: every Sale of the six months ending in today's, by its own
    date's month."""
    window: list[Month] = [Month.containing(today)]
    while len(window) < SALES_BY_MONTH_WINDOW:
        window.insert(0, window[0].previous)
    totals = {str(m): 0 for m in window}
    count = 0
    total = 0
    for sale in sales:
        key = str(Month.containing(sale.date))
        if key in totals:
            totals[key] += sale.total
            count += 1
            total += sale.total
    return totals, average_sale(total, count)


def check(sales: list[OwedSale], today: date = TODAY) -> None:
    result = customer_sales(sales, today)
    totals, average = direct(sales, today)
    assert {str(m.month): m.total for m in result.by_month} == totals
    assert [str(m.month) for m in result.by_month] == list(totals)
    assert result.average_sale == average


def test_the_window_is_six_months_oldest_first_ending_in_the_current_month() -> None:
    result = customer_sales([], TODAY)
    assert SALES_BY_MONTH_WINDOW == 6
    assert [str(m.month) for m in result.by_month] == [
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
    ]


def test_no_sales_gives_six_zeros_and_no_average() -> None:
    result = customer_sales([], TODAY)
    assert [m.total for m in result.by_month] == [0] * 6
    assert result.average_sale is None


def test_only_sales_older_than_the_window_give_zeros_and_no_average() -> None:
    sales = [owed_sale(1, date(2026, 5, 31), 1_000), owed_sale(2, date(2025, 11, 21), 500)]
    result = customer_sales(sales, TODAY)
    assert [m.total for m in result.by_month] == [0] * 6
    assert result.average_sale is None


def test_the_window_edges_and_the_current_month() -> None:
    sales = [
        owed_sale(1, date(2026, 5, 31), 900),  # the day before the window: out
        owed_sale(2, FIRST_DAY, 1_000),  # the first day of the window
        owed_sale(3, TODAY, 2_000),  # today
        owed_sale(4, date(2026, 11, 30), 4_000),  # later in the current month: counts
        owed_sale(5, date(2026, 12, 1), 8_000),  # the month after: out
    ]
    result = customer_sales(sales, TODAY)
    totals = {str(m.month): m.total for m in result.by_month}
    assert totals == {
        "2026-06": 1_000,
        "2026-07": 0,
        "2026-08": 0,
        "2026-09": 0,
        "2026-10": 0,
        "2026-11": 6_000,
    }
    assert result.average_sale == 2_333  # 7000 / 3
    check(sales)


def test_empty_months_between_sales_are_zero() -> None:
    sales = [owed_sale(1, date(2026, 6, 15), 300), owed_sale(2, date(2026, 10, 2), 700)]
    result = customer_sales(sales, TODAY)
    assert [m.total for m in result.by_month] == [300, 0, 0, 0, 700, 0]
    check(sales)


def test_a_zero_sale_counts_in_the_denominator() -> None:
    sales = [owed_sale(1, date(2026, 11, 1), 1_000), owed_sale(2, date(2026, 11, 2), 0)]
    result = customer_sales(sales, TODAY)
    assert result.by_month[-1].total == 1_000
    assert result.average_sale == 500
    check(sales)


def test_shipping_and_unpaid_sales_count_through_the_stored_total() -> None:
    paid = owed_sale(1, date(2026, 9, 3), 1_250, on_the_spot_method="Efectivo")
    unpaid = owed_sale(2, date(2026, 9, 4), 750)
    result = customer_sales([paid, unpaid], TODAY)
    assert result.by_month[3].total == 2_000
    check([paid, unpaid])


def test_the_average_rounds_a_half_up() -> None:
    sales = [owed_sale(1, date(2026, 10, 1), 3), owed_sale(2, date(2026, 10, 2), 4)]
    assert customer_sales(sales, TODAY).average_sale == 4  # 3.5 up, never 3
    just_below = [owed_sale(1, date(2026, 10, 1), 499)] + [
        owed_sale(i, date(2026, 10, 1), 0) for i in range(2, 201)
    ]
    assert customer_sales(just_below, TODAY).average_sale == 2  # 2.495 down
    check(sales)
    check(just_below)


def test_a_january_today_reaches_back_across_the_year_boundary() -> None:
    today = date(2027, 1, 15)
    sales = [owed_sale(1, date(2026, 8, 1), 100), owed_sale(2, date(2026, 7, 31), 50)]
    result = customer_sales(sales, today)
    assert [str(m.month) for m in result.by_month] == [
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
        "2026-12",
        "2027-01",
    ]
    assert result.by_month[0].total == 100
    check(sales, today)


def test_a_leap_february_keeps_its_last_day_in_february() -> None:
    today = date(2028, 2, 29)
    sales = [owed_sale(1, date(2028, 2, 29), 10), owed_sale(2, date(2027, 9, 30), 20)]
    result = customer_sales(sales, today)
    assert [str(m.month) for m in result.by_month][0] == "2027-09"
    assert result.by_month[-1].total == 10
    assert result.by_month[0].total == 20
    check(sales, today)
