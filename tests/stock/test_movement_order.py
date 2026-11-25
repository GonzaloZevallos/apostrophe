"""The movement order and its cursor (app/stock/domain/movement_order.py): pure domain,
no database."""

import base64
from datetime import UTC, date, datetime, timedelta, timezone

import pytest

from app.stock.domain.movement_order import (
    ENTRY_RANK,
    MOVEMENTS_CURSOR_MAX_LENGTH,
    WITHDRAWAL_RANK,
    InvalidMovementCursor,
    MovementCursor,
    MovementKey,
)

DAY = date(2026, 10, 2)
INSTANT = datetime(2026, 10, 2, 19, 0, 0, 123456, tzinfo=UTC)
LITERAL = "The movements cursor is not valid."
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def _key(
    rank: int = ENTRY_RANK,
    id: int = 1,
    day: date = DAY,
    recorded_at: datetime = INSTANT,
) -> MovementKey:
    return MovementKey(day, recorded_at, rank, id)


def _text(payload: str) -> str:
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


GOOD = "v1|2026-10-02|2026-10-02T19:00:00.123456+00:00|0|7"


@pytest.mark.parametrize(
    ("later", "earlier"),
    [
        (_key(WITHDRAWAL_RANK, 5), _key(ENTRY_RANK, 5)),  # tied entry, then tied withdrawal
        (_key(ENTRY_RANK, 4), _key(ENTRY_RANK, 5)),  # tied entries: id descending
        (_key(WITHDRAWAL_RANK, 4), _key(WITHDRAWAL_RANK, 5)),  # tied withdrawals
        (_key(ENTRY_RANK, 5, day=date(2026, 10, 1)), _key(WITHDRAWAL_RANK, 1)),  # older day
        (
            _key(ENTRY_RANK, 1, recorded_at=INSTANT - timedelta(microseconds=1)),
            _key(WITHDRAWAL_RANK, 99),  # recorded_at before rank and id
        ),
    ],
)
def test_comes_after_is_strict_over_tied_keys(later: MovementKey, earlier: MovementKey) -> None:
    assert later.comes_after(earlier)
    assert not earlier.comes_after(later)
    assert not later.comes_after(later)


def test_newest_first_sorts_day_then_recorded_at_then_rank_then_id() -> None:
    keys = [
        _key(WITHDRAWAL_RANK, 3),
        _key(ENTRY_RANK, 1),
        _key(ENTRY_RANK, 2),
        _key(ENTRY_RANK, 9, recorded_at=INSTANT + timedelta(microseconds=1)),
        _key(ENTRY_RANK, 9, day=date(2026, 10, 3)),
    ]

    ordered = sorted(keys, key=MovementKey.newest_first)

    assert [(k.day.day, k.recorded_at.microsecond, k.rank, k.id) for k in ordered] == [
        (3, 123456, 0, 9),
        (2, 123457, 0, 9),
        (2, 123456, 0, 2),
        (2, 123456, 0, 1),
        (2, 123456, 1, 3),
    ]


@pytest.mark.parametrize(
    ("recorded_at", "rank", "id"),
    [
        (INSTANT, 2, 1),
        (INSTANT, 0, 0),
        (datetime(2026, 10, 2, 19, 0), 0, 1),
        (datetime(2026, 10, 2, 19, 0, tzinfo=timezone(timedelta(hours=1))), 0, 1),
    ],
)
def test_a_key_refuses_a_bad_field(recorded_at: datetime, rank: int, id: int) -> None:
    with pytest.raises(ValueError):
        MovementKey(DAY, recorded_at, rank, id)


def test_a_cursor_round_trips_microseconds_and_utc() -> None:
    key = _key(WITHDRAWAL_RANK, 42)

    text = MovementCursor.encode(key)

    assert "=" not in text
    assert MovementCursor.decode(text) == key
    assert base64.urlsafe_b64decode(text + "=" * (-len(text) % 4)).decode() == (
        "v1|2026-10-02|2026-10-02T19:00:00.123456+00:00|1|42"
    )


_BAD: list[str] = [
    _text(GOOD) + "=",  # padding present
    _text(GOOD)[:-1] + "!",  # a character outside the alphabet
    _text(GOOD)[:-1] + "é",  # non-ASCII
    _text(GOOD.replace("+00:00", "Z")),
    _text(GOOD.replace("2026-10-02|", "20261002|", 1)),  # compact date
    _text(GOOD.replace("2026-10-02|", "2026-W40-5|", 1)),  # ISO-week date
    _text(GOOD.replace(".123456", "")),  # no microseconds
    _text(GOOD.replace("+00:00", "+01:00")),
    _text(GOOD.replace("|0|7", "|+1|7")),
    _text(GOOD.replace("|0|7", "|0| 1")),
    _text(GOOD.replace("|0|7", "|0|1_0")),
    _text(GOOD.replace("|0|7", "|0|٣")),  # a non-ASCII digit
    _text(GOOD.replace("v1", "v2")),
    _text(GOOD + "|extra"),  # 6 fields
    _text(GOOD.rsplit("|", 1)[0]),  # 4 fields
    _text(GOOD.replace("|0|7", "|0|0")),  # id 0
    _text(GOOD.replace("|0|7", "|2|7")),  # rank 2
    "QUJDR",  # a length that is never valid base64
    "////////",  # garbage that is not a cursor
    "",
]


@pytest.mark.parametrize("text", _BAD)
def test_a_malformed_cursor_is_refused_with_the_fixed_message(text: str) -> None:
    with pytest.raises(InvalidMovementCursor) as refused:
        MovementCursor.decode(text)

    assert str(refused.value) == LITERAL
    assert text == "" or text not in str(refused.value)
    assert refused.value.__cause__ is None
    assert refused.value.__suppress_context__
    assert InvalidMovementCursor.code == "stock.movements_cursor_invalid"


def test_a_non_canonical_but_decodable_cursor_is_refused() -> None:
    """The same bytes with other trailing bits in the last character decode the same, so
    only the re-encoding check refuses them."""
    canonical = _text(GOOD)
    pad = "=" * (-len(canonical) % 4)
    variants = [
        canonical[:-1] + c
        for c in ALPHABET
        if c != canonical[-1]
        and base64.urlsafe_b64decode(canonical[:-1] + c + pad)
        == base64.urlsafe_b64decode(canonical + pad)
    ]

    assert variants
    for variant in variants:
        with pytest.raises(InvalidMovementCursor):
            MovementCursor.decode(variant)


def test_the_cursor_of_the_largest_key_fits_the_length_cap_and_round_trips() -> None:
    largest = _key(
        WITHDRAWAL_RANK,
        9_999_999_999_999_999_999,
        date.max,
        datetime(9999, 12, 31, 23, 59, 59, 999999, tzinfo=UTC),
    )

    text = MovementCursor.encode(largest)

    assert len(text) == 91
    assert len(text) <= MOVEMENTS_CURSOR_MAX_LENGTH
    assert MovementCursor.decode(text) == largest


def test_a_cursor_one_character_over_the_length_cap_is_refused_before_any_decoding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _no_base64(_: bytes) -> bytes:
        raise AssertionError("base64 was reached")

    monkeypatch.setattr(base64, "urlsafe_b64decode", _no_base64)
    text = "A" * (MOVEMENTS_CURSOR_MAX_LENGTH + 1)

    with pytest.raises(InvalidMovementCursor) as refused:
        MovementCursor.decode(text)

    assert MOVEMENTS_CURSOR_MAX_LENGTH == 128
    assert len(text) == 129
    assert str(refused.value) == LITERAL
