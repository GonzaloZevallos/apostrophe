"""`purchases_in`: the total cost of a period's purchase stock entries (CODING_STANDARDS
section 5: domain unit test, no infrastructure)."""

from __future__ import annotations

from datetime import date, datetime

from app.shared.grams import Grams
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.purchases import purchases_in

AT = datetime(2026, 9, 1, 10, 0)


def _purchase(entry_date: date, total_cost: int, id: int = 1) -> StockEntry:
    return StockEntry(
        entry_date=entry_date,
        variety_id=1,
        origin=Origin.PURCHASE,
        grams=Grams.of("10"),
        total_cost=total_cost,
        note=None,
        recorded_at=AT,
        id=id,
    )


def _harvest(entry_date: date, id: int = 2) -> StockEntry:
    return StockEntry(
        entry_date=entry_date,
        variety_id=1,
        origin=Origin.HARVEST,
        grams=Grams.of("10"),
        total_cost=None,
        note=None,
        recorded_at=AT,
        id=id,
    )


def _adjustment(entry_date: date, id: int = 3) -> StockEntry:
    return StockEntry(
        entry_date=entry_date,
        variety_id=1,
        origin=Origin.ADJUSTMENT,
        grams=Grams.of("-3"),
        total_cost=None,
        note=None,
        recorded_at=AT,
        id=id,
    )


def test_it_sums_purchases_in_the_inclusive_range() -> None:
    entries = [
        _purchase(date(2026, 9, 1), 1_000, id=1),
        _purchase(date(2026, 9, 30), 2_000, id=2),
        _purchase(date(2026, 10, 1), 5_000, id=3),
    ]

    total = purchases_in(entries, date(2026, 9, 1), date(2026, 9, 30))

    assert total == 3_000


def test_other_origins_are_never_counted() -> None:
    entries = [_harvest(date(2026, 9, 5)), _adjustment(date(2026, 9, 5))]

    total = purchases_in(entries, date(2026, 9, 1), date(2026, 9, 30))

    assert total == 0


def test_an_empty_business_gives_zero() -> None:
    assert purchases_in([], date(2026, 9, 1), date(2026, 9, 30)) == 0
