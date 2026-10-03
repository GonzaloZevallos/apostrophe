"""`lots_and_draws`: grouping and ordering entries and sale-line draws by variety, with
no infrastructure (CONTEXT.md: Lot, Draw, Lot order; ADR-0009)."""

from __future__ import annotations

from datetime import date, datetime

from app.shared.grams import Grams
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.lot_order import SaleLineDraw, lots_and_draws

DAY = date(2026, 9, 1)
LATER = date(2026, 9, 10)
AT = datetime(2026, 9, 1, 10, 0)
LATER_AT = datetime(2026, 9, 10, 10, 0)


def _entry(
    *,
    id: int,
    variety_id: int = 1,
    grams: str = "10",
    origin: Origin = Origin.OPENING_STOCK,
    entry_date: date = DAY,
    recorded_at: datetime = AT,
    total_cost: int | None = None,
) -> StockEntry:
    return StockEntry.of(
        entry_date,
        variety_id,
        origin,
        Grams.of(grams),
        total_cost,
        None,
        today=LATER,
        recorded_at=recorded_at,
        id=id,
    )


def test_a_positive_entry_is_a_lot() -> None:
    grouped = lots_and_draws([_entry(id=1, grams="10")], [])

    lots, draws = grouped[1]
    assert len(lots) == 1
    assert lots[0].grams == Grams.of("10")
    assert draws == []


def test_a_negative_adjustment_is_a_draw_carried_as_a_positive_magnitude() -> None:
    grouped = lots_and_draws(
        [_entry(id=1, grams="-4", origin=Origin.ADJUSTMENT)], []
    )

    lots, draws = grouped[1]
    assert lots == []
    assert len(draws) == 1
    assert draws[0].grams == Grams.of("4")


def test_a_sale_line_is_always_a_draw_gifts_included() -> None:
    sale_draw = SaleLineDraw(
        variety_id=1, day=DAY, recorded_at=AT, sale_id=5, position=0, grams=Grams.of("3")
    )

    grouped = lots_and_draws([], [sale_draw])

    lots, draws = grouped[1]
    assert lots == []
    assert len(draws) == 1
    assert draws[0].grams == Grams.of("3")


def test_varieties_are_grouped_separately() -> None:
    grouped = lots_and_draws(
        [_entry(id=1, variety_id=1, grams="10"), _entry(id=2, variety_id=2, grams="20")], []
    )

    assert set(grouped) == {1, 2}
    assert grouped[1][0][0].grams == Grams.of("10")
    assert grouped[2][0][0].grams == Grams.of("20")


def test_a_group_is_sorted_by_date_first() -> None:
    later = _entry(id=1, grams="10", entry_date=LATER, recorded_at=AT)
    earlier = _entry(id=2, grams="5", entry_date=DAY, recorded_at=LATER_AT)

    lots, _ = lots_and_draws([later, earlier], [])[1]

    assert [lot.order.ref_id for lot in lots] == [2, 1]


def test_same_day_breaks_the_tie_by_recorded_order() -> None:
    recorded_second = _entry(id=1, grams="10", recorded_at=LATER_AT)
    recorded_first = _entry(id=2, grams="5", recorded_at=AT)

    lots, _ = lots_and_draws([recorded_second, recorded_first], [])[1]

    assert [lot.order.ref_id for lot in lots] == [2, 1]


def test_a_variety_with_nothing_is_simply_absent() -> None:
    grouped = lots_and_draws([_entry(id=1, variety_id=1)], [])

    assert 2 not in grouped
