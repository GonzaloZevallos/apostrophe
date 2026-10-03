"""`allocate`: FIFO cost of goods over a variety's lots, with no infrastructure
(CONTEXT.md: Draw, Pending cost, Cost of goods sold; ADR-0009).

Unit cases pin the rules from the plan; the property test at the end runs `allocate`
over many random lot/draw sequences and checks the invariants that must hold for any
of them (success criterion 3 in `stock.md`): a lot's draws and cost never exceed it,
both land on exactly its own total once it is used up, and pending grams are never a
$0 cost.
"""

from __future__ import annotations

import random
from datetime import date, datetime
from fractions import Fraction

from app.shared.grams import Grams
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.lot_order import Draw, Lot, LotOrder

DAY = date(2026, 9, 1)
AT = datetime(2026, 9, 1, 10, 0)


def _lot(ref_id: int, grams: str, total_cost: int | None, day: date = DAY) -> Lot:
    return Lot(LotOrder(day, AT, 0, ref_id, 0), 1, Grams.of(grams), total_cost)


def _draw(ref_id: int, grams: str, day: date = DAY, position: int = 0) -> Draw:
    return Draw(LotOrder(day, AT, 1, ref_id, position), 1, Grams.of(grams))


def test_a_draw_entirely_within_one_lot_is_costed_in_full() -> None:
    lots = [_lot(1, "10", 1_000)]
    draws = [_draw(1, "4")]

    [result] = allocate(lots, draws)

    assert result.costed == 400
    assert result.pending == Grams.of("0")


def test_a_draw_past_every_lot_is_entirely_pending_never_a_zero_cost() -> None:
    [result] = allocate([], [_draw(1, "4")])

    assert result.costed is None
    assert result.pending == Grams.of("4")


def test_a_draw_split_between_a_lot_and_pending() -> None:
    lots = [_lot(1, "10", 1_000)]
    draws = [_draw(1, "14")]

    [result] = allocate(lots, draws)

    assert result.costed == 1_000
    assert result.pending == Grams.of("4")


def test_a_harvest_with_no_recorded_cost_costs_zero_not_pending() -> None:
    lots = [_lot(1, "10", None)]
    draws = [_draw(1, "4")]

    [result] = allocate(lots, draws)

    assert result.costed == 0
    assert result.pending == Grams.of("0")


def test_draws_take_from_the_oldest_lot_first() -> None:
    lots = [_lot(1, "5", 500, day=DAY), _lot(2, "5", 1_000, day=date(2026, 9, 5))]
    draws = [_draw(1, "6")]

    [result] = allocate(lots, draws)

    # 5g from lot 1 (its whole 500) + 1g from lot 2 (1/5 of 1000 = 200): 700.
    assert result.costed == 700
    refs = [lot_draw.lot_ref for lot_draw in result.lot_draws]
    assert refs == [1, 2]


def test_a_later_lot_covers_grams_pending_from_an_earlier_draw() -> None:
    draws = [_draw(1, "10"), _draw(2, "5")]
    lots = [_lot(1, "8", 800, day=DAY)]

    first, second = allocate(lots, draws)

    assert first.costed == 800
    assert first.pending == Grams.of("2")
    assert second.costed is None
    assert second.pending == Grams.of("5")


def test_a_used_up_lot_sums_to_exactly_its_cost_over_several_draws() -> None:
    # 1000 over 3g does not divide evenly; three 1g draws must still sum to 1000.
    lots = [_lot(1, "3", 1_000)]
    draws = [_draw(1, "1", position=0), _draw(1, "1", position=1), _draw(1, "1", position=2)]

    results = allocate(lots, draws)

    assert sum(result.costed or 0 for result in results) == 1_000


def test_negative_adjustment_draws_consume_lots_the_same_way() -> None:
    # A negative adjustment is just a `Draw`, like a sale line.
    lots = [_lot(1, "10", 1_000)]
    draws = [_draw(1, "3")]

    [result] = allocate(lots, draws)

    assert result.costed == 300


# -- property: lot conservation over many random sequences ----------------------------


def _random_lots_and_draws(rng: random.Random) -> tuple[list[Lot], list[Draw]]:
    lot_count = rng.randint(0, 4)
    lots = []
    for i in range(lot_count):
        grams = rng.randint(1, 500)
        total_cost = rng.choice([None, rng.randint(0, 10_000)])
        lots.append(_lot(i, str(grams), total_cost, day=date(2026, 9, 1 + i)))

    draw_count = rng.randint(0, 6)
    draws = []
    for i in range(draw_count):
        grams = rng.randint(1, 200)
        draws.append(_draw(100 + i, str(grams), day=date(2026, 9, 1 + i), position=i))

    return lots, draws


def test_allocation_conserves_every_lot_over_many_random_sequences() -> None:
    for seed in range(500):
        rng = random.Random(seed)
        lots, draws = _random_lots_and_draws(rng)

        results = allocate(lots, draws)

        _assert_lot_conservation(lots, results)
        _assert_pending_is_never_a_zero_cost(results)
        _assert_draw_grams_are_fully_accounted_for(draws, results)


def _assert_lot_conservation(lots: list[Lot], results: list[DrawCost]) -> None:
    drawn_grams: dict[int, int] = {}
    drawn_cost: dict[int, Fraction] = {}
    for result in results:
        for lot_draw in result.lot_draws:
            drawn_grams[lot_draw.lot_ref] = (
                drawn_grams.get(lot_draw.lot_ref, 0) + lot_draw.grams.hundredths
            )
            drawn_cost[lot_draw.lot_ref] = drawn_cost.get(lot_draw.lot_ref, Fraction(0)) + (
                lot_draw.cost
            )

    for index, lot in enumerate(lots):
        taken_grams = drawn_grams.get(index, 0)
        taken_cost = drawn_cost.get(index, Fraction(0))
        assert taken_grams <= lot.grams.hundredths
        if lot.total_cost is not None:
            assert taken_cost <= Fraction(lot.total_cost)
            if taken_grams == lot.grams.hundredths:
                assert taken_cost == Fraction(lot.total_cost)
        else:
            assert taken_cost == 0


def _assert_pending_is_never_a_zero_cost(results: list[DrawCost]) -> None:
    for result in results:
        if result.pending.hundredths > 0 and not result.lot_draws:
            assert result.costed is None


def _assert_draw_grams_are_fully_accounted_for(draws: list[Draw], results: list[DrawCost]) -> None:
    for draw, result in zip(draws, results, strict=True):
        taken = sum(lot_draw.grams.hundredths for lot_draw in result.lot_draws)
        assert taken + result.pending.hundredths == draw.grams.hundredths
