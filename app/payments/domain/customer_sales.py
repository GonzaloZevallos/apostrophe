"""A Customer's Sales by month and their Average sale (CONTEXT.md: Sale, Average sale).

Pure and clock-free: `today` is a parameter. Every Sale counts in the month of its own
date at its stored total (shipping included, paid or not, a gift's $0 included). Month
boundaries come only from `app.shared.calendar.Month`, and the rounding only from
`app.shared.average`.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from app.payments.domain.settlement import OwedSale
from app.shared.average import average_sale
from app.shared.calendar import Month

# How many calendar months the read covers, ending in the current one: the number of
# months the ClientesCompu design draws. One constant, the same for every Business; #330
# will sweep it.
SALES_BY_MONTH_WINDOW = 6


@dataclass(frozen=True)
class MonthTotal:
    month: Month
    total: int


@dataclass(frozen=True)
class CustomerSales:
    by_month: tuple[MonthTotal, ...]
    average_sale: int | None


def customer_sales(sales: Sequence[OwedSale], today: date) -> CustomerSales:
    """The `SALES_BY_MONTH_WINDOW` months ending in `today`'s, oldest first and always
    that many (a month with no Sales is 0), and the Average sale over the Sales in them,
    `None` when there are none. A Sale dated later in the current month counts; one in a
    later month, or before the window, does not."""
    month = Month.containing(today)
    window = [month]
    while len(window) < SALES_BY_MONTH_WINDOW:
        window.append(window[-1].previous)
    window.reverse()
    totals = {month: 0 for month in window}
    count = 0
    for sale in sales:
        sale_month = Month.containing(sale.date)
        if sale_month in totals:
            totals[sale_month] += sale.total
            count += 1
    return CustomerSales(
        by_month=tuple(MonthTotal(month, total) for month, total in totals.items()),
        average_sale=average_sale(sum(totals.values()), count),
    )
