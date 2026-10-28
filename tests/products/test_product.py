"""The rules of a variety and its price history, with no infrastructure."""

from datetime import UTC, date, datetime

import pytest

from app.shared.quantity import Quantity
from app.products.domain.product import (
    DuplicateEffectiveDate,
    InvalidName,
    InvalidPriceEntry,
    PriceEntry,
    UnknownPriceEntry,
    Product,
    ProductArchived,
    ProductName,
    VipPriceNotBelowList,
)


def test_a_name_is_trimmed_and_its_inner_spaces_collapsed() -> None:
    name = ProductName.of("  24K   Gold ")

    assert name.value == "24K Gold"
    assert name.key == ProductName.of("24k gold").key


@pytest.mark.parametrize("raw", ["", "   ", "x" * 61])
def test_a_name_must_be_present_and_short(raw: str) -> None:
    with pytest.raises(InvalidName):
        ProductName.of(raw)


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
        ProductName.of(raw)

    with pytest.raises(InvalidName, match=f"^{message}$"):
        ProductName(raw)


def test_an_untrimmed_name_built_directly_is_refused_with_its_own_message() -> None:
    # VarietyName.of() collapses before constructing, so this path is only reached
    # by building the value object directly with spaces the caller did not collapse.
    with pytest.raises(
        InvalidName, match="^a variety name has no leading, trailing or repeated spaces$"
    ):
        ProductName(" 24K Gold")


def test_a_price_entry_needs_a_positive_list_price() -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 0)


@pytest.mark.parametrize(
    ("bulk_price", "bulk_minimum"),
    [(10_000, None), (None, Quantity.of(10))],
)
def test_a_bulk_price_and_a_bulk_minimum_go_together(
    bulk_price: int | None, bulk_minimum: Quantity | None
) -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 11_000, bulk_price, bulk_minimum)


@pytest.mark.parametrize(
    ("bulk_price", "bulk_minimum"),
    [
        (11_000, Quantity.of(10)),
        (12_000, Quantity.of(10)),
        (0, Quantity.of(10)),
        (10_000, Quantity(0)),
    ],
)
def test_a_bulk_price_is_positive_and_lower_than_the_list_price_from_some_grams(
    bulk_price: int, bulk_minimum: Quantity
) -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 11_000, bulk_price, bulk_minimum)


def _gold() -> Product:
    variety = Product(ProductName.of("24K Gold"))
    variety.record_price(PriceEntry.of(date(2026, 1, 1), 11_000, 10_000, Quantity.of(10), id=1))
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


def test_a_vip_price_below_the_list_price_is_kept() -> None:
    entry = PriceEntry.of(date(2026, 1, 1), 11_000, vip_price=9_000)

    assert entry.vip_price == 9_000


def test_a_vip_price_needs_no_bulk_terms_and_a_bulk_price_needs_no_vip_price() -> None:
    only_vip = PriceEntry.of(date(2026, 1, 1), 11_000, vip_price=9_000)
    only_bulk = PriceEntry.of(date(2026, 1, 1), 11_000, 10_000, Quantity.of(10))

    assert only_vip.bulk is None
    assert only_bulk.vip_price is None


def test_a_vip_price_is_never_compared_with_the_bulk_price() -> None:
    entry = PriceEntry.of(date(2026, 1, 1), 11_000, 8_000, Quantity.of(10), vip_price=10_500)

    assert (entry.bulk is not None and entry.bulk.price, entry.vip_price) == (8_000, 10_500)


@pytest.mark.parametrize("vip_price", [11_000, 12_000])
def test_a_vip_price_at_or_above_the_list_price_is_refused_with_its_own_code(
    vip_price: int,
) -> None:
    with pytest.raises(VipPriceNotBelowList) as refused:
        PriceEntry.of(date(2026, 1, 1), 11_000, vip_price=vip_price)

    assert refused.value.code == "variety.vip_price_not_below_list"
    assert str(vip_price) not in str(refused.value)
    assert "11000" not in str(refused.value)


@pytest.mark.parametrize("vip_price", [0, -5])
def test_a_vip_price_must_be_positive(vip_price: int) -> None:
    with pytest.raises(InvalidPriceEntry):
        PriceEntry.of(date(2026, 1, 1), 11_000, vip_price=vip_price)


def test_a_variety_is_live_until_it_carries_an_archived_instant() -> None:
    from datetime import UTC, datetime

    live = Product(ProductName.of("Gelato"))
    archived = Product(ProductName.of("Gelato"), archived_at=datetime(2026, 1, 1, tzinfo=UTC))

    assert live.archived_at is None
    assert not live.is_archived
    assert archived.is_archived


def _bare_gold() -> Product:
    return Product(ProductName.of("24K Gold"), id=1)


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

    with pytest.raises(ProductArchived):
        variety.rename(ProductName.of("Silver"))
    with pytest.raises(ProductArchived):
        variety.record_price(PriceEntry.of(date(2026, 2, 1), 12_000))
    with pytest.raises(ProductArchived):
        variety.delete_price(5)

    assert variety.name.value == "24K Gold"
    assert len(variety.price_entries) == 1


def test_a_restored_variety_can_be_renamed_again() -> None:
    variety = _bare_gold()
    variety.archive(datetime(2026, 10, 6, 12, 0, tzinfo=UTC))
    variety.restore()

    variety.rename(ProductName.of("Silver"))

    assert variety.name.value == "Silver"
