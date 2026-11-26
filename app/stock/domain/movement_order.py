"""Movement order: the one order a variety's or a business's stock movements (entries and
withdrawals mixed) are read in, and the cursor that seeks into it (CONTEXT.md: Stock
entry, Stock withdrawal).

This is not the Lot order of `lot_order.py`: that one is oldest first and orders lots and
draws for allocation; this one is newest first and orders what a person reads as a
history. The two never import each other and neither is used for the other's rows.

A movement sorts by its date descending, then its `recorded_at` descending, then its
rank ascending (an entry before a withdrawal), then its id descending. The instant is
compared exactly, as whole microseconds, never as a float. `MovementKey.newest_first()`
and `comes_after()` are the only comparisons of movement position.
"""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import ClassVar

ENTRY_RANK = 0
WITHDRAWAL_RANK = 1

MOVEMENTS_PAGE_MAX = 100
MOVEMENTS_PAGE_DEFAULT = 20

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
_DAY_MICROSECONDS = 86_400_000_000
_VERSION = "v1"
_URL_SAFE = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")


@dataclass(frozen=True)
class MovementKey:
    """Where a movement sits in the movement order. `recorded_at` carries UTC."""

    day: date
    recorded_at: datetime
    rank: int
    id: int

    def __post_init__(self) -> None:
        if self.rank not in (ENTRY_RANK, WITHDRAWAL_RANK):
            raise ValueError("a movement's rank is 0 (entry) or 1 (withdrawal)")
        if self.id <= 0:
            raise ValueError("a movement's id is above 0")
        if self.recorded_at.tzinfo is None or self.recorded_at.utcoffset() != timedelta(0):
            raise ValueError("a movement's recorded_at carries UTC")

    def newest_first(self) -> tuple[int, int, int, int]:
        """The sort key: ascending on it is newest first."""
        since_epoch = self.recorded_at - _EPOCH
        microseconds = (
            since_epoch.days * _DAY_MICROSECONDS
            + since_epoch.seconds * 1_000_000
            + since_epoch.microseconds
        )
        return (-self.day.toordinal(), -microseconds, self.rank, -self.id)

    def comes_after(self, cursor: MovementKey) -> bool:
        """True when this movement sorts strictly after `cursor` in the movement order."""
        return self.newest_first() > cursor.newest_first()


class InvalidMovementCursor(Exception):
    """The cursor text is not one `MovementCursor.encode` made. The message is fixed and
    never carries the input."""

    code: ClassVar[str] = "stock.movements_cursor_invalid"

    def __init__(self) -> None:
        super().__init__("The movements cursor is not valid.")


class MovementCursor:
    """The opaque position after which the next page of movements starts: URL-safe base64,
    without padding, of `v1|<date>|<recorded_at UTC, microseconds>|<rank>|<id>`."""

    @staticmethod
    def encode(key: MovementKey) -> str:
        instant = key.recorded_at.astimezone(UTC).isoformat(timespec="microseconds")
        payload = f"{_VERSION}|{key.day.isoformat()}|{instant}|{key.rank}|{key.id}"
        return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")

    @staticmethod
    def decode(text: str) -> MovementKey:
        """Only the canonical text `encode` makes is accepted: anything else, however it
        happens to parse, raises `InvalidMovementCursor`."""
        try:
            key = MovementCursor._parsed(text)
            if MovementCursor.encode(key) != text:
                raise InvalidMovementCursor
        except (ValueError, binascii.Error, InvalidMovementCursor):
            raise InvalidMovementCursor from None
        return key

    @staticmethod
    def _parsed(text: str) -> MovementKey:
        if not text.isascii() or not set(text) <= _URL_SAFE or len(text) % 4 == 1:
            raise InvalidMovementCursor
        padded = text + "=" * (-len(text) % 4)
        fields = base64.urlsafe_b64decode(padded).decode().split("|")
        if len(fields) != 5 or fields[0] != _VERSION:
            raise InvalidMovementCursor
        _, day, instant, rank, ident = fields
        recorded_at = datetime.fromisoformat(instant)
        if recorded_at.utcoffset() != timedelta(0):
            raise InvalidMovementCursor
        if rank not in ("0", "1") or not (ident.isdecimal() and ident.isascii()):
            raise InvalidMovementCursor
        return MovementKey(date.fromisoformat(day), recorded_at, int(rank), int(ident))
