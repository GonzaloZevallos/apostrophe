"""`StockEntry.of` (CODING_STANDARDS section 5: domain unit tests, no infrastructure)."""

from datetime import date, datetime, timedelta

import pytest

from app.shared.grams import Grams
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.errors import (
    EntryCostInvalid,
    EntryCostOnNegativeAdjustment,
    EntryCostRequired,
    EntryDateInFuture,
    EntryGramsInvalid,
    EntryNoteTooLong,
)

TODAY = date(2026, 10, 2)
RECORDED_AT = datetime(2026, 10, 2, 12, 0)
TEN_GRAMS = Grams.of("10")


def _entry(
    *,
    entry_date: date = TODAY,
    variety_id: int = 1,
    origin: Origin = Origin.OPENING_STOCK,
    grams: Grams = TEN_GRAMS,
    total_cost: int | None = None,
    note: str | None = None,
    today: date = TODAY,
    recorded_at: datetime = RECORDED_AT,
) -> StockEntry:
    return StockEntry.of(
        entry_date,
        variety_id,
        origin,
        grams,
        total_cost,
        note,
        today,
        recorded_at,
    )


def test_an_opening_stock_entry_with_no_cost_is_recorded() -> None:
    entry = _entry()

    assert entry.total_cost is None
    assert entry.grams == Grams.of("10")


def test_a_purchase_needs_a_total_cost() -> None:
    with pytest.raises(EntryCostRequired):
        _entry(origin=Origin.PURCHASE, total_cost=None)


def test_a_purchase_with_a_zero_cost_is_invalid() -> None:
    with pytest.raises(EntryCostInvalid):
        _entry(origin=Origin.PURCHASE, total_cost=0)


def test_a_purchase_with_a_positive_cost_is_recorded() -> None:
    entry = _entry(origin=Origin.PURCHASE, total_cost=85_000)

    assert entry.total_cost == 85_000


def test_grams_are_never_zero() -> None:
    with pytest.raises(EntryGramsInvalid):
        _entry(grams=Grams.of("0"))


def test_a_harvest_cannot_be_negative() -> None:
    with pytest.raises(EntryGramsInvalid):
        _entry(origin=Origin.HARVEST, grams=Grams.of("-5"))


def test_only_an_adjustment_may_be_negative() -> None:
    entry = _entry(origin=Origin.ADJUSTMENT, grams=Grams.of("-5"), total_cost=None)

    assert entry.grams == Grams.of("-5")


def test_a_negative_adjustment_refuses_a_cost() -> None:
    """The enforcement artefact: a negative adjustment is the one place a cost is
    always refused, whatever amount is given."""
    with pytest.raises(EntryCostOnNegativeAdjustment):
        _entry(origin=Origin.ADJUSTMENT, grams=Grams.of("-5"), total_cost=1_000)


def test_a_positive_adjustment_may_carry_a_cost() -> None:
    entry = _entry(origin=Origin.ADJUSTMENT, grams=Grams.of("5"), total_cost=1_000)

    assert entry.total_cost == 1_000


def test_a_future_date_is_refused() -> None:
    with pytest.raises(EntryDateInFuture):
        _entry(entry_date=TODAY + timedelta(days=1))


def test_a_note_over_200_characters_is_refused() -> None:
    with pytest.raises(EntryNoteTooLong):
        _entry(note="x" * 201)


def test_a_note_is_trimmed_and_empty_becomes_none() -> None:
    entry = _entry(note="  hola  ")
    blank = _entry(note="   ")

    assert entry.note == "hola"
    assert blank.note is None


def test_recorded_at_is_not_one_of_the_validated_fields() -> None:
    """An edit passes the existing `recorded_at` back in unchanged; `of` never
    recomputes it from `today` (CODING_STANDARDS: "set once on create")."""
    earlier = RECORDED_AT - timedelta(days=30)

    entry = _entry(recorded_at=earlier)

    assert entry.recorded_at == earlier
