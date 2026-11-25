"""The business movements read (app/stock/application/read_movements.py): the use case
with honest in-memory fakes of its ports, no database."""

from collections.abc import Collection
from dataclasses import astuple
from datetime import UTC, date, datetime, timedelta

import pytest

from app.shared.quantity import Quantity
from app.stock.application.errors import MovementLabelMissing
from app.stock.application.ports import ProductLabel
from app.stock.application.read_movements import (
    BusinessMovementsPage,
    key_of,
    read_business_movements,
)
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.movement_order import (
    ENTRY_RANK,
    MOVEMENTS_PAGE_MAX,
    WITHDRAWAL_RANK,
    InvalidMovementCursor,
    MovementCursor,
    MovementKey,
)
from app.stock.domain.withdrawal import Withdrawal, WithdrawalLine
from app.stock.domain.withdrawal_reason import ReasonName
from app.stock.domain.withdrawal_reason import WithdrawalReason as ReasonEntity

DAY = date(2026, 10, 2)
NOON = datetime(2026, 10, 2, 12, 0, 0, tzinfo=UTC)
MICRO = timedelta(microseconds=1)
SENTINEL = "SECRET-NAME"


def _entry(id: int, day: date = DAY, at: datetime = NOON, variety_id: int = 1) -> StockEntry:
    return StockEntry(day, variety_id, Origin.HARVEST, Quantity(100), None, None, at, id)


def _withdrawal(
    id: int,
    day: date = DAY,
    at: datetime = NOON,
    variety_ids: tuple[int, ...] = (1,),
    reason_id: int = 1,
) -> Withdrawal:
    lines = tuple(WithdrawalLine(v, Quantity(100)) for v in variety_ids)
    return Withdrawal(reason_id, day, None, lines, at, id)


class FakeMovements:
    """Honest: filters by `comes_after`, sorts by `newest_first`, cuts each kind at
    limit + 1, as the port docstring requires."""

    def __init__(self, rows: list[StockEntry | Withdrawal]) -> None:
        self.rows = rows
        self.calls = 0

    def page(self, before: MovementKey | None, limit: int) -> list[StockEntry | Withdrawal]:
        self.calls += 1
        out: list[StockEntry | Withdrawal] = []
        for kind in (StockEntry, Withdrawal):
            of_kind = [
                row
                for row in self.rows
                if isinstance(row, kind) and (before is None or key_of(row).comes_after(before))
            ]
            of_kind.sort(key=lambda row: key_of(row).newest_first())
            out.extend(of_kind[: limit + 1])
        return out


class FakeLabels:
    def __init__(self, names: dict[int, str]) -> None:
        self.names = names
        self.calls: list[set[int]] = []

    def labels(self, variety_ids: Collection[int]) -> dict[int, ProductLabel]:
        self.calls.append(set(variety_ids))
        return {i: ProductLabel(self.names[i], False) for i in variety_ids if i in self.names}


class FakeReasons:
    def __init__(self, names: dict[int, str]) -> None:
        self.names = names
        self.calls = 0

    def all(self) -> list[ReasonEntity]:
        self.calls += 1
        return [
            ReasonEntity(i, ReasonName.of(name), position)
            for position, (i, name) in enumerate(self.names.items())
        ]

    def get(self, reason_id: int) -> ReasonEntity | None:
        raise AssertionError("not read by the movements read")

    def add(self, name: ReasonName, position: int) -> ReasonEntity:
        raise AssertionError("a write")

    def save(self, reason: ReasonEntity) -> ReasonEntity:
        raise AssertionError("a write")

    def reorder(self, reason_ids: list[int]) -> None:
        raise AssertionError("a write")

    def count(self) -> int:
        raise AssertionError("not read by the movements read")

    def has_withdrawals(self, reason_id: int) -> bool:
        raise AssertionError("not read by the movements read")

    def remove(self, reason_id: int) -> bool:
        raise AssertionError("a write")


def _read(
    rows: list[StockEntry | Withdrawal],
    before: str | None = None,
    limit: int = 20,
) -> BusinessMovementsPage:
    return read_business_movements(
        FakeMovements(rows),
        FakeLabels({1: "Tomato", 2: "Basil", 3: "Mint"}),
        FakeReasons({1: "Spoiled", 2: "Gift"}),
        before,
        limit,
    )


def _ids(page: BusinessMovementsPage) -> list[tuple[str, int | None]]:
    return [("e" if isinstance(r, StockEntry) else "w", r.id) for r in page.rows]


def test_key_of_picks_the_date_instant_rank_and_id_of_each_kind() -> None:
    entry = _entry(7, date(2026, 9, 1), NOON + MICRO)
    withdrawal = _withdrawal(8, date(2026, 9, 2), NOON)

    assert astuple(key_of(entry)) == (date(2026, 9, 1), NOON + MICRO, ENTRY_RANK, 7)
    assert astuple(key_of(withdrawal)) == (date(2026, 9, 2), NOON, WITHDRAWAL_RANK, 8)


def test_a_shared_instant_with_limit_one_resumes_on_the_other_kind() -> None:
    rows: list[StockEntry | Withdrawal] = [_withdrawal(1), _entry(1)]

    first = _read(rows, limit=1)

    assert _ids(first) == [("e", 1)]
    assert first.next == MovementCursor.encode(key_of(first.rows[0]))
    second = _read(rows, before=first.next, limit=1)
    assert _ids(second) == [("w", 1)]
    assert second.next is None


def test_the_mirror_case_where_the_withdrawal_is_newest_resumes_on_the_entry() -> None:
    rows: list[StockEntry | Withdrawal] = [_entry(5), _withdrawal(2, at=NOON + MICRO)]

    first = _read(rows, limit=1)

    assert _ids(first) == [("w", 2)]
    assert first.next == MovementCursor.encode(key_of(first.rows[0]))
    second = _read(rows, before=first.next, limit=1)
    assert _ids(second) == [("e", 5)]
    assert second.next is None


MIXED: list[StockEntry | Withdrawal] = [
    _entry(1),
    _entry(2),
    _entry(3, at=NOON + MICRO),
    _entry(4, day=date(2026, 10, 1), at=NOON + timedelta(days=3)),
    _entry(5, day=date(2026, 9, 30)),
    _withdrawal(1),
    _withdrawal(2),
    _withdrawal(3, at=NOON - MICRO),
    _withdrawal(4, day=date(2026, 10, 3), at=NOON - timedelta(days=1)),
    _withdrawal(5, day=date(2026, 10, 1), at=NOON + timedelta(days=3)),
]


@pytest.mark.parametrize("limit", [1, 2, 3, 100])
def test_a_full_walk_returns_every_row_in_order_with_no_gap_and_no_duplicate(limit: int) -> None:
    walked: list[StockEntry | Withdrawal] = []
    before: str | None = None
    while True:
        page = _read(MIXED, before=before, limit=limit)
        walked.extend(page.rows)
        before = page.next
        if before is None:
            break

    expected = sorted(MIXED, key=lambda row: key_of(row).newest_first())
    assert [(type(r), r.id) for r in walked] == [(type(r), r.id) for r in expected]


def test_next_is_set_when_one_kind_alone_holds_limit_plus_one_rows() -> None:
    rows: list[StockEntry | Withdrawal] = [_entry(1), _entry(2), _entry(3)]

    page = _read(rows, limit=2)

    assert _ids(page) == [("e", 3), ("e", 2)]
    assert page.next == MovementCursor.encode(key_of(page.rows[-1]))


def test_next_is_none_when_exactly_limit_rows_exist() -> None:
    page = _read([_entry(1), _withdrawal(1)], limit=2)

    assert len(page.rows) == 2
    assert page.next is None


def test_the_page_carries_the_labels_and_reason_names_it_shows() -> None:
    rows: list[StockEntry | Withdrawal] = [
        _entry(1, variety_id=2),
        _withdrawal(1, variety_ids=(1, 3), reason_id=2),
    ]

    page = _read(rows)

    assert {i: label.name for i, label in page.labels.items()} == {
        1: "Tomato",
        2: "Basil",
        3: "Mint",
    }
    assert page.reason_names == {2: "Gift"}


@pytest.mark.parametrize("limit", [0, -1, MOVEMENTS_PAGE_MAX + 1])
def test_a_limit_outside_the_page_bounds_is_refused(limit: int) -> None:
    with pytest.raises(ValueError, match="a page has between 1 and 100 movements"):
        _read([_entry(1)], limit=limit)


def test_the_largest_page_is_allowed() -> None:
    assert _read([_entry(1)], limit=MOVEMENTS_PAGE_MAX).next is None


def test_an_invalid_cursor_is_refused_before_the_ports_are_read() -> None:
    movements = FakeMovements([_entry(1)])

    with pytest.raises(InvalidMovementCursor):
        read_business_movements(
            movements, FakeLabels({1: "Tomato"}), FakeReasons({1: "Spoiled"}), "garbage", 5
        )

    assert movements.calls == 0


def _spy_on_encode(monkeypatch: pytest.MonkeyPatch) -> list[MovementKey]:
    reached: list[MovementKey] = []

    def spy(key: MovementKey) -> str:
        reached.append(key)
        return "x"

    monkeypatch.setattr(MovementCursor, "encode", spy)
    return reached


def test_a_missing_product_label_is_refused_before_a_cursor_is_made(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reached = _spy_on_encode(monkeypatch)
    rows: list[StockEntry | Withdrawal] = [_entry(2, variety_id=9), _entry(1, variety_id=1)]

    with pytest.raises(MovementLabelMissing) as refused:
        read_business_movements(
            FakeMovements(rows),
            FakeLabels({1: SENTINEL}),
            FakeReasons({1: SENTINEL}),
            None,
            1,
        )

    assert str(refused.value) == "a movement's product or reason has no label"
    assert "9" not in str(refused.value)
    assert SENTINEL not in str(refused.value)
    assert not hasattr(MovementLabelMissing, "code")
    assert reached == []


def test_a_missing_line_product_label_is_refused() -> None:
    rows: list[StockEntry | Withdrawal] = [_withdrawal(1, variety_ids=(1, 9))]

    with pytest.raises(MovementLabelMissing):
        _read(rows)


def test_a_missing_reason_is_refused_before_a_cursor_is_made(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reached = _spy_on_encode(monkeypatch)
    rows: list[StockEntry | Withdrawal] = [_withdrawal(2, reason_id=9), _withdrawal(1)]

    with pytest.raises(MovementLabelMissing) as refused:
        read_business_movements(
            FakeMovements(rows),
            FakeLabels({1: SENTINEL}),
            FakeReasons({1: SENTINEL}),
            None,
            1,
        )

    assert str(refused.value) == "a movement's product or reason has no label"
    assert SENTINEL not in str(refused.value)
    assert reached == []


def test_each_port_is_read_once_per_page_and_nothing_is_written() -> None:
    movements = FakeMovements(MIXED)
    labels = FakeLabels({1: "Tomato"})
    reasons = FakeReasons({1: "Spoiled", 2: "Gift"})

    page = read_business_movements(movements, labels, reasons, None, 4)

    assert len(page.rows) == 4
    assert movements.calls == 1
    assert labels.calls == [{1}]
    assert reasons.calls == 1
