"""`read_varieties_stock` and `read_variety_stock` over in-memory fakes of the stock
ports: one `history` read for many varieties, every requested id answered, and the
single-variety read equal to the many-variety one."""

from collections.abc import Collection
from datetime import UTC, date, datetime

from app.shared.quantity import Quantity
from app.stock.application.read_stock import read_varieties_stock, read_variety_stock
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.lot_order import SaleLineDraw, WithdrawalLineDraw
from app.stock.domain.threshold import Threshold

TODAY = date(2026, 10, 2)
RECORDED = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


class _UnusedWrites:
    """The `StockEntries` methods a read never calls."""

    def by_id(self, entry_id: int) -> StockEntry | None:
        raise AssertionError("a read never looks an entry up")

    def add(self, entry: StockEntry) -> StockEntry:
        raise AssertionError("a read never writes")

    def save(self, entry: StockEntry) -> StockEntry:
        raise AssertionError("a read never writes")

    def remove(self, entry_id: int) -> None:
        raise AssertionError("a read never writes")


class FakeEntries(_UnusedWrites):
    def __init__(self, rows: list[StockEntry]) -> None:
        self.rows = rows
        self.reads: list[Collection[int] | None] = []

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        self.reads.append(variety_ids)
        return [r for r in self.rows if variety_ids is None or r.variety_id in variety_ids]


class NoDraws:
    def for_varieties(self, variety_ids: Collection[int] | None) -> list[SaleLineDraw]:
        return []


class NoWithdrawals:
    def for_varieties(self, variety_ids: Collection[int] | None) -> list[WithdrawalLineDraw]:
        return []


class RaisingEntries(_UnusedWrites):
    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        raise AssertionError("no port is read for an empty set")


class RaisingDraws:
    def for_varieties(self, variety_ids: Collection[int] | None) -> list[SaleLineDraw]:
        raise AssertionError("no port is read for an empty set")


class RaisingWithdrawals:
    def for_varieties(self, variety_ids: Collection[int] | None) -> list[WithdrawalLineDraw]:
        raise AssertionError("no port is read for an empty set")


class FakeThresholds:
    def __init__(self, values: dict[int, Threshold]) -> None:
        self.values = values

    def get(self, variety_id: int) -> Threshold | None:
        return self.values.get(variety_id)

    def all(self) -> dict[int, Threshold]:
        return dict(self.values)

    def set(self, variety_id: int, threshold: Threshold) -> None:
        self.values[variety_id] = threshold

    def clear(self, variety_id: int) -> None:
        self.values.pop(variety_id, None)


def _entry(entry_id: int, variety_id: int, grams: int) -> StockEntry:
    return StockEntry(
        TODAY, variety_id, Origin.HARVEST, Quantity(grams), None, None, RECORDED, entry_id
    )


def _entries() -> FakeEntries:
    return FakeEntries([_entry(1, 7, 1000), _entry(2, 8, 250), _entry(3, 9, 5000)])


def test_the_single_read_equals_the_many_read_for_the_same_history() -> None:
    thresholds = FakeThresholds({7: Threshold(Quantity(2000))})
    single = read_variety_stock(_entries(), NoDraws(), NoWithdrawals(), thresholds, 7, TODAY)
    many = read_varieties_stock(
        _entries(), NoDraws(), NoWithdrawals(), {7}, TODAY, thresholds=thresholds
    )
    assert single == many[7]
    assert single.threshold == Threshold(Quantity(2000))
    assert single.level.status == "low"


def test_without_thresholds_no_variety_has_one() -> None:
    stock = read_varieties_stock(_entries(), NoDraws(), NoWithdrawals(), {7}, TODAY)
    assert stock[7].threshold is None
    assert stock[7].level.quantity == Quantity(1000)


def test_two_varieties_read_together_each_get_their_own_level() -> None:
    entries = _entries()
    stock = read_varieties_stock(entries, NoDraws(), NoWithdrawals(), {7, 8}, TODAY)
    assert set(stock) == {7, 8}
    assert stock[7].level.quantity == Quantity(1000)
    assert stock[8].level.quantity == Quantity(250)
    assert entries.reads == [{7, 8}]


def test_a_variety_with_no_movements_has_zero_grams() -> None:
    stock = read_varieties_stock(_entries(), NoDraws(), NoWithdrawals(), {7, 99}, TODAY)
    assert stock[99].variety_id == 99
    assert stock[99].level.quantity == Quantity(0)
    assert stock[99].level.status == "no_entries"


def test_an_empty_set_returns_nothing_and_reads_no_port() -> None:
    stock = read_varieties_stock(
        RaisingEntries(), RaisingDraws(), RaisingWithdrawals(), set(), TODAY
    )
    assert stock == {}
