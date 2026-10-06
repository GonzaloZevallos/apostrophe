"""The rules of a variety and its price history, with no infrastructure."""

from datetime import UTC, date, datetime

import pytest

from app.shared.grams import Grams
from app.varieties.domain.variety import (
    DuplicateEffectiveDate,
    InvalidName,
    InvalidPriceEntry,
    PriceEntry,
    UnknownPriceEntry,
    Variety,
    VarietyArchived,
    VarietyName,
)


def test_a_name_is_trimmed_and_its_inner_spaces_collapsed() -> None:
    name = VarietyName.of("  24K   Gold ")

    assert name.value == "24K Gold"
    assert name.key == VarietyName.of("24k gold").key


@pytest.mark.parametrize("raw", ["", "   ", "x" * 61])
def test_a_name_must_be_present_and_short(raw: str) -> None:
    with pytest.raises(InvalidName):
        VarietyName.of(raw)


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ("", "a variety needs a name"),
        ("x" * 61, "a variety name has at most 60 characters"),
    ],
)
def test_a_name_s_error_messages_are_unchanged_by_the_shared_name_rule(
    raw: str, message: str
) -> None:
    with pytest.raises(InvalidName, match=f"^{message}$"):
        VarietyName.of(raw)

    with pytest.raises(InvalidName, match=f"^{message}$"):
        VarietyName(raw)


def test_an_untrimmed_name_built_directly_is_refused_with_its_own_message() -> None:
    # VarietyName.of() collapses before constructing, so this path is only reached
    # by building the value object directly with spaces the caller did not collapse.
    with pytest.raises(
        InvalidName, match="^a variety name has no leading, trailing or repeated spaces$"
    ):
        VarietyName(" 24K Gold")


def test_a_price_entry_needs_a_positive_list_price() -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 0)


@pytest.mark.parametrize(
    ("bulk_price", "bulk_minimum"),
    [(10_000, None), (None, Grams.of(10))],
)
def test_a_bulk_price_and_a_bulk_minimum_go_together(
    bulk_price: int | None, bulk_minimum: Grams | None
) -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 11_000, bulk_price, bulk_minimum)


@pytest.mark.parametrize(
    ("bulk_price", "bulk_minimum"),
    [(11_000, Grams.of(10)), (12_000, Grams.of(10)), (0, Grams.of(10)), (10_000, Grams(0))],
)
def test_a_bulk_price_is_positive_and_lower_than_the_list_price_from_some_grams(
    bulk_price: int, bulk_minimum: Grams
) -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 11_000, bulk_price, bulk_minimum)


def _gold() -> Variety:
    variety = Variety(VarietyName.of("24K Gold"))
    variety.record_price(PriceEntry.of(date(2026, 1, 1), 11_000, 10_000, Grams.of(10), id=1))
    variety.record_price(PriceEntry.of(date(2026, 3, 1), 12_000, id=2))
    return variety


@pytest.mark.parametrize(
    ("on", "expected_list_price"),
    [
        (date(2025, 12, 31), None),
        (date(2026, 1, 1), 11_000),
        (date(2026, 2, 28), 11_000),
        (date(2026, 3, 1), 12_000),
        (date(2027, 1, 1), 12_000),
    ],
)
def test_the_current_price_is_the_latest_entry_effective_on_or_before_the_day(
    on: date, expected_list_price: int | None
) -> None:
    price = _gold().current_price(on)

    assert (price.list_price if price else None) == expected_list_price


def test_a_variety_has_one_price_entry_per_effective_date() -> None:
    with pytest.raises(DuplicateEffectiveDate):
        _gold().record_price(PriceEntry.of(date(2026, 3, 1), 13_000))


def test_a_deleted_entry_stops_being_the_current_price() -> None:
    variety = _gold()

    variety.delete_price(2)

    price = variety.current_price(date(2026, 6, 1))
    assert price is not None and price.list_price == 11_000


def test_deleting_an_entry_the_variety_does_not_have_is_refused() -> None:
    with pytest.raises(UnknownPriceEntry):
        _gold().delete_price(99)


def test_the_price_history_lists_the_newest_entry_first() -> None:
    history = _gold().price_history()

    assert [e.effective_from for e in history] == [date(2026, 3, 1), date(2026, 1, 1)]


def _bare_gold() -> Variety:
    return Variety(VarietyName.of("24K Gold"), id=1)


def test_archiving_sets_the_instant_once_and_a_second_archive_keeps_it() -> None:
    variety = _bare_gold()

    variety.archive(datetime(2026, 10, 6, 12, 0, tzinfo=UTC))
    variety.archive(datetime(2026, 10, 7, 12, 0, tzinfo=UTC))

    assert variety.is_archived
    assert variety.archived_at == datetime(2026, 10, 6, 12, 0, tzinfo=UTC)


def test_restoring_clears_the_instant_and_restoring_a_live_variety_changes_nothing() -> None:
    variety = _bare_gold()
    variety.restore()
    assert not variety.is_archived

    variety.archive(datetime(2026, 10, 6, 12, 0, tzinfo=UTC))
    variety.restore()

    assert not variety.is_archived
    assert variety.archived_at is None


def test_an_archived_variety_refuses_to_be_renamed_priced_or_unpriced() -> None:
    variety = _bare_gold()
    variety.record_price(PriceEntry.of(date(2026, 1, 1), 11_000, id=5))
    variety.archive(datetime(2026, 10, 6, 12, 0, tzinfo=UTC))

    with pytest.raises(VarietyArchived):
        variety.rename(VarietyName.of("Silver"))
    with pytest.raises(VarietyArchived):
        variety.record_price(PriceEntry.of(date(2026, 2, 1), 12_000))
    with pytest.raises(VarietyArchived):
        variety.delete_price(5)

    assert variety.name.value == "24K Gold"
    assert len(variety.price_entries) == 1


def test_a_restored_variety_can_be_renamed_again() -> None:
    variety = _bare_gold()
    variety.archive(datetime(2026, 10, 6, 12, 0, tzinfo=UTC))
    variety.restore()

    variety.rename(VarietyName.of("Silver"))

    assert variety.name.value == "Silver"
