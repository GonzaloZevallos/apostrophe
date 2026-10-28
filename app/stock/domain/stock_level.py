"""A variety's stock, status, sold-out-since date and days left (CONTEXT.md: Stock,
Stock status, Days left; ADR-0009).

The one place these are computed (the plan's invariant): no SQL aggregate and no front
code derives them. Reads the same `lots_and_draws` grouping `allocate` reads, so both
agree about what counts in and out — but needs none of `allocate`'s per-gram cost: a
variety's stock is a plain sum of signed grams, by day.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, assert_never

from app.shared.quantity import Quantity
from app.stock.domain.draw_source import DrawSource
from app.stock.domain.lot_order import Draw, Lot
from app.stock.domain.threshold import Threshold

Status = Literal["no_entries", "sold_out", "low", "ok"]

DAYS_LEFT_WINDOW = 30


@dataclass(frozen=True)
class StockLevel:
    quantity: Quantity
    status: Status
    sold_out_since: date | None
    days_left: int | None


def stock_level(
    lots: list[Lot], draws: list[Draw], threshold: Threshold | None, today: date
) -> StockLevel:
    """`lots` and `draws` are one variety's own, in any order (only their day and
    their signed grams matter here). Status, in order, the first that fits:
    no entries (no lot and no draw at all), sold out (grams <= 0), low (under the
    threshold), ok."""
    if not lots and not draws:
        return StockLevel(Quantity(0), "no_entries", None, None)

    by_day: dict[date, int] = {}
    for lot in lots:
        by_day[lot.order.day] = by_day.get(lot.order.day, 0) + lot.quantity.hundredths
    for draw in draws:
        by_day[draw.order.day] = by_day.get(draw.order.day, 0) - draw.quantity.hundredths

    days = sorted(by_day)
    balances: list[int] = []
    running = 0
    for day in days:
        running += by_day[day]
        balances.append(running)
    quantity = Quantity(running)

    if quantity.hundredths <= 0:
        status: Status = "sold_out"
        sold_out_since = _sold_out_since(days, balances)
    elif threshold is not None and quantity.hundredths < threshold.quantity.hundredths:
        status = "low"
        sold_out_since = None
    else:
        status = "ok"
        sold_out_since = None

    days_left = _days_left(quantity, draws, today)

    return StockLevel(quantity, status, sold_out_since, days_left)


def _sold_out_since(days: list[date], balances: list[int]) -> date:
    """The earliest day with a lot or a draw from which the end-of-day balance stays
    `<= 0` on every such day after it, through the last one (already `<= 0`, or this
    would never have been called)."""
    index = len(days) - 1
    while index > 0 and balances[index - 1] <= 0:
        index -= 1
    return days[index]


def _days_left(quantity: Quantity, draws: list[Draw], today: date) -> int | None:
    """`stock / (grams out in the last 30 days / 30)`, floored to a whole day. Only
    sale lines and both withdrawal sources pace it: a negative adjustment is a count
    correcting the figure, not grams going out. `None` with nothing to pace from."""
    if quantity.hundredths <= 0:
        return None
    window_start = today - timedelta(days=DAYS_LEFT_WINDOW - 1)
    out_hundredths = sum(
        draw.quantity.hundredths
        for draw in draws
        if _paces(draw) and window_start <= draw.order.day <= today
    )
    if out_hundredths == 0:
        return None
    return (quantity.hundredths * DAYS_LEFT_WINDOW) // out_hundredths


def _paces(draw: Draw) -> bool:
    match draw.source:
        case DrawSource.SALE_LINE | DrawSource.PROMOTION | DrawSource.OWN_USE:
            return True
        case DrawSource.ADJUSTMENT:
            return False
        case _:
            assert_never(draw.source)
