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

from app.shared.quantity import Quantity
from app.stock.domain.allocation import DrawCost, allocate
from app.stock.domain.draw_source import DrawSource
from app.stock.domain.lot_order import Draw, Lot, LotOrder

DAY = date(2026, 9, 1)
AT = datetime(2026, 9, 1, 10, 0)


def _lot(ref_id: int, quantity: str, total_cost: int | None, day: date = DAY) -> Lot:
    return Lot(LotOrder(day, AT, 0, ref_id, 0), 1, Quantity.of(quantity), total_cost)


def _draw(ref_id: int, quantity: str, day: date = DAY, position: int = 0) -> Draw:
    return Draw(LotOrder(day, AT, 1, ref_id, position), 1, Quantity.of(quantity), DrawSource.SALE_LINE)


def test_a_draw_entirely_within_one_lot_is_costed_in_full() -> None:
    lots = [_lot(1, "10", 1_000)]
    draws = [_draw(1, "4")]

    [result] = allocate(lots, draws)

    assert result.costed == 400
    assert result.pending == Quantity.of("0")


def test_a_draw_past_every_lot_is_entirely_pending_never_a_zero_cost() -> None:
    [result] = allocate([], [_draw(1, "4")])

    assert result.costed is None
    assert result.pending == Quantity.of("4")


def test_a_draw_split_between_a_lot_and_pending() -> None:
    lots = [_lot(1, "10", 1_000)]
    draws = [_draw(1, "14")]

    [result] = allocate(lots, draws)

    assert result.costed == 1_000
    assert result.pending == Quantity.of("4")


def test_a_harvest_with_no_recorded_cost_costs_zero_not_pending() -> None:
    lots = [_lot(1, "10", None)]
    draws = [_draw(1, "4")]

    [result] = allocate(lots, draws)

    assert result.costed == 0
    assert result.pending == Quantity.of("0")


def test_draws_take_from_the_oldest_lot_first() -> None:
    lots = [_lot(1, "5", 500, day=DAY), _lot(2, "5", 1_000, day=date(2026, 9, 5))]
    draws = [_draw(1, "6")]

    [result] = allocate(lots, draws)

    # 5g from lot 1 (its whole 500) + 1g from lot 2 (1/5 of 1000 = 200): 700.
    assert result.costed == 700
    refs = [lot_draw.lot_ref for lot_draw in result.lot_draws]
    assert refs == [1, 2]


def test_grams_past_every_lot_stay_pending_through_further_draws() -> None:
    """With no further lot recorded, a draw past the lots' own grams and every draw
    after it both stay pending — `allocate` never invents a lot to cover them."""
    draws = [_draw(1, "10"), _draw(2, "5")]
    lots = [_lot(1, "8", 800, day=DAY)]

    first, second = allocate(lots, draws)

    assert first.costed == 800
    assert first.pending == Quantity.of("2")
    assert second.costed is None
    assert second.pending == Quantity.of("5")


def test_a_later_dated_lot_still_covers_an_earlier_draws_pending_grams() -> None:
    """A lot's own date does not have to come before a draw it covers: `allocate`
    draws from lots strictly in lot order, never comparing a lot's date to a draw's
    own (PRD: "A later entry of any origin covers them in date order, wherever its
    date falls")."""
    lots = [_lot(1, "8", 800, day=DAY), _lot(2, "5", 500, day=date(2026, 9, 5))]
    draws = [_draw(1, "10", day=date(2026, 9, 2))]

    [result] = allocate(lots, draws)

    # 8g from lot 1 (its whole 800) + 2g from lot 2 (2/5 of 500 = 200): 1000, none
    # pending, even though lot 2 is dated after the draw.
    assert result.costed == 1_000
    assert result.pending == Quantity.of("0")


def test_a_used_up_lot_sums_to_exactly_its_cost_over_several_draws() -> None:
    # 1000 over 3g does not divide evenly; three 1g draws must still sum to 1000.
    lots = [_lot(1, "3", 1_000)]
    draws = [_draw(1, "1", position=0), _draw(1, "1", position=1), _draw(1, "1", position=2)]

    results = allocate(lots, draws)

    assert sum(result.costed or 0 for result in results) == 1_000


def test_a_single_draw_spanning_two_lots_is_rounded_once_not_lot_by_lot() -> None:
    """10/3 does not divide evenly. Rounding each lot's own share separately (lot 1's
    full 3g at a rounded $3/g = 9, plus lot 2's 1g at the same rounded rate = 3) would
    answer 12; the correct exact-until-the-end accounting answers 13."""
    lots = [_lot(1, "3", 10), _lot(2, "3", 10)]
    draws = [_draw(1, "4")]

    [result] = allocate(lots, draws)

    assert result.costed == 13
    assert result.pending == Quantity.of("0")


def test_a_negative_adjustment_draw_is_costed_like_a_sale_line() -> None:
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
        quantity = rng.randint(1, 500)
        total_cost = rng.choice([None, rng.randint(0, 10_000)])
        lots.append(_lot(i, str(quantity), total_cost, day=date(2026, 9, 1 + i)))

    draw_count = rng.randint(0, 6)
    draws = []
    for i in range(draw_count):
        quantity = rng.randint(1, 200)
        draws.append(_draw(100 + i, str(quantity), day=date(2026, 9, 1 + i), position=i))

    return lots, draws


def test_allocation_conserves_every_lot_over_many_random_sequences() -> None:
    for seed in range(500):
        rng = random.Random(seed)
        lots, draws = _random_lots_and_draws(rng)

        results = allocate(lots, draws)

        _assert_lot_conservation(lots, results)
        _assert_pending_is_never_a_zero_cost(results)
        _assert_draw_quantity_are_fully_accounted_for(draws, results)
        _assert_the_rounded_total_conserves_the_lots_cost(lots, draws, results)


def _assert_lot_conservation(lots: list[Lot], results: list[DrawCost]) -> None:
    drawn_quantity: dict[int, int] = {}
    drawn_cost: dict[int, Fraction] = {}
    for result in results:
        for lot_draw in result.lot_draws:
            drawn_quantity[lot_draw.lot_ref] = (
                drawn_quantity.get(lot_draw.lot_ref, 0) + lot_draw.quantity.hundredths
            )
            drawn_cost[lot_draw.lot_ref] = drawn_cost.get(lot_draw.lot_ref, Fraction(0)) + (
                lot_draw.cost
            )

    for index, lot in enumerate(lots):
        taken_quantity = drawn_quantity.get(index, 0)
        taken_cost = drawn_cost.get(index, Fraction(0))
        assert taken_quantity <= lot.quantity.hundredths
        if lot.total_cost is not None:
            assert taken_cost <= Fraction(lot.total_cost)
            if taken_quantity == lot.quantity.hundredths:
                assert taken_cost == Fraction(lot.total_cost)
        else:
            assert taken_cost == 0


def _assert_pending_is_never_a_zero_cost(results: list[DrawCost]) -> None:
    for result in results:
        if result.pending.hundredths > 0 and not result.lot_draws:
            assert result.costed is None


def _assert_draw_quantity_are_fully_accounted_for(draws: list[Draw], results: list[DrawCost]) -> None:
    for draw, result in zip(draws, results, strict=True):
        taken = sum(lot_draw.quantity.hundredths for lot_draw in result.lot_draws)
        assert taken + result.pending.hundredths == draw.quantity.hundredths


def _assert_the_rounded_total_conserves_the_lots_cost(
    lots: list[Lot], draws: list[Draw], results: list[DrawCost]
) -> None:
    """The field production actually reads (`DrawCost.costed`, rounded), not just the
    test-only exact `LotDraw.cost` fractions: summed over every draw, it never exceeds
    what the lots carry, and lands on exactly that total once every lot is drawn."""
    costed_total = sum(result.costed or 0 for result in results)
    priced_total = sum(lot.total_cost for lot in lots if lot.total_cost is not None)
    assert costed_total <= priced_total

    total_lot_quantity = sum(lot.quantity.hundredths for lot in lots)
    total_draw_quantity = sum(draw.quantity.hundredths for draw in draws)
    if total_draw_quantity >= total_lot_quantity:
        assert costed_total == priced_total
