"""`costs_for_sale`: the service behind sales' `LineCosts` port (ADR-0009), with fakes
standing in for `StockEntries` and `Draws` so the test stays at the seam the plan
declares (`app/stock/adapters/line_costs.py`) with no real database. It is the one
place a sale line's cost of goods is computed, read fresh from the variety's lots and
draws, never frozen.
"""

from __future__ import annotations

from collections.abc import Collection
from datetime import date, datetime

from app.sales.application.ports import LineCost
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import Sale, SaleLine
from app.shared.grams import Grams
from app.stock.adapters.line_costs import costs_for_sale
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.lot_order import SaleLineDraw

AT = datetime(2026, 9, 1, 10, 0)
TODAY = date(2026, 10, 2)


class FakeEntries:
    """A `StockEntries` fake with just enough to satisfy the port: `costs_for_sale`
    only ever reads through `for_varieties`."""

    def __init__(self, entries: list[StockEntry]) -> None:
        self._entries = entries

    def by_id(self, entry_id: int) -> StockEntry | None:
        raise NotImplementedError

    def add(self, entry: StockEntry) -> StockEntry:
        raise NotImplementedError

    def save(self, entry: StockEntry) -> StockEntry:
        raise NotImplementedError

    def remove(self, entry_id: int) -> None:
        raise NotImplementedError

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        if variety_ids is None:
            return list(self._entries)
        return [e for e in self._entries if e.variety_id in variety_ids]


class FakeDraws:
    def __init__(self, draws: list[SaleLineDraw]) -> None:
        self._draws = draws

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[SaleLineDraw]:
        if variety_ids is None:
            return list(self._draws)
        return [d for d in self._draws if d.variety_id in variety_ids]


def _entry(variety_id: int, grams: str, total_cost: int | None, entry_id: int) -> StockEntry:
    return StockEntry(
        entry_date=date(2026, 9, 1),
        variety_id=variety_id,
        origin=Origin.PURCHASE if total_cost is not None else Origin.OPENING_STOCK,
        grams=Grams.of(grams),
        total_cost=total_cost,
        note=None,
        recorded_at=AT,
        id=entry_id,
    )


def _line(variety_id: int, grams: str) -> SaleLine:
    return SaleLine(
        variety_id=variety_id,
        grams=Grams.of(grams),
        pricing_rule=PricingRule.LIST,
        price_per_gram=10_000,
        line_total=int(Grams.of(grams).as_decimal() * 10_000),
    )


def _draw(variety_id: int, sale_id: int, position: int, grams: str) -> SaleLineDraw:
    return SaleLineDraw(
        variety_id=variety_id,
        day=TODAY,
        recorded_at=AT,
        sale_id=sale_id,
        position=position,
        grams=Grams.of(grams),
    )


def _sale(sale_id: int, lines: tuple[SaleLine, ...]) -> Sale:
    return Sale(
        date=TODAY,
        customer_id=None,
        shipping_charged=0,
        note=None,
        lines=lines,
        payment=None,
        recorded_at=AT,
        id=sale_id,
    )


def test_a_line_fully_covered_by_one_lot_is_costed_from_it() -> None:
    entries = FakeEntries([_entry(1, "100", 100_000, entry_id=1)])
    sale = _sale(7, (_line(1, "10"),))
    draws = FakeDraws([_draw(1, 7, 0, "10")])

    costs = costs_for_sale(entries, draws, sale)

    assert costs == [LineCost(costed=10_000, pending_grams=Grams(0))]


def test_a_line_past_every_lot_is_pending_never_a_zero_cost() -> None:
    """The reject case for the one place pending grams are decided: with no lot at
    all, `allocate` must answer a `None` cost and the whole line as pending, never a
    costed `0` standing in for "nothing to cost yet"."""
    entries = FakeEntries([])
    sale = _sale(7, (_line(1, "10"),))
    draws = FakeDraws([_draw(1, 7, 0, "10")])

    costs = costs_for_sale(entries, draws, sale)

    assert costs == [LineCost(costed=None, pending_grams=Grams.of("10"))]


def test_a_line_spanning_two_lots_is_split_between_costed_and_pending() -> None:
    entries = FakeEntries(
        [_entry(1, "5", 5_000, entry_id=1), _entry(1, "3", 6_000, entry_id=2)]
    )
    sale = _sale(7, (_line(1, "10"),))
    draws = FakeDraws([_draw(1, 7, 0, "10")])

    costs = costs_for_sale(entries, draws, sale)

    # 8 g drawn across both lots, $5 000 + $6 000 = $11 000 exactly; the other 2 g of
    # the 10 g line have no lot behind them, so they are pending, never a $0 cost.
    assert costs == [LineCost(costed=11_000, pending_grams=Grams.of("2"))]


def test_two_lines_of_different_varieties_are_matched_back_by_position() -> None:
    entries = FakeEntries(
        [_entry(1, "10", 10_000, entry_id=1), _entry(2, "10", 20_000, entry_id=2)]
    )
    sale = _sale(9, (_line(1, "10"), _line(2, "10")))
    draws = FakeDraws([_draw(1, 9, 0, "10"), _draw(2, 9, 1, "10")])

    costs = costs_for_sale(entries, draws, sale)

    assert costs == [
        LineCost(costed=10_000, pending_grams=Grams(0)),
        LineCost(costed=20_000, pending_grams=Grams(0)),
    ]
