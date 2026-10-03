"""A stock entry (CONTEXT.md: Stock entry, Purchase, Harvest, Opening stock,
Adjustment).

`StockEntry.of` is the one constructor recording and editing both go through, so the
same rules apply either way. `recorded_at` is set once, from the injected clock, when
an entry is first recorded; an edit carries it through unchanged (the caller passes the
existing value back in) — lots and draws are ordered only by it, through `LotOrder`
(built elsewhere), never touched here.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from app.shared.grams import Grams
from app.stock.domain.errors import (
    EntryCostInvalid,
    EntryCostOnNegativeAdjustment,
    EntryCostRequired,
    EntryDateInFuture,
    EntryGramsInvalid,
    EntryNoteTooLong,
)

NOTE_MAX_LENGTH = 200


class Origin(StrEnum):
    PURCHASE = "purchase"
    HARVEST = "harvest"
    OPENING_STOCK = "opening_stock"
    ADJUSTMENT = "adjustment"


@dataclass
class StockEntry:
    entry_date: date
    variety_id: int
    origin: Origin
    grams: Grams
    total_cost: int | None
    note: str | None
    recorded_at: datetime
    id: int | None = None

    @classmethod
    def of(
        cls,
        entry_date: date,
        variety_id: int,
        origin: Origin,
        grams: Grams,
        total_cost: int | None,
        note: str | None,
        today: date,
        recorded_at: datetime,
        id: int | None = None,
    ) -> StockEntry:
        if entry_date > today:
            raise EntryDateInFuture("a stock entry is not dated after today")
        if grams.hundredths == 0:
            raise EntryGramsInvalid("grams are never zero")
        if origin is not Origin.ADJUSTMENT and not grams.is_positive:
            raise EntryGramsInvalid(f"{origin.value} grams are above zero")
        if origin is Origin.PURCHASE:
            if total_cost is None:
                raise EntryCostRequired("a purchase needs a total cost")
            if total_cost <= 0:
                raise EntryCostInvalid("a total cost is above zero")
        elif not grams.is_positive:
            # The only way grams can be negative here is a negative adjustment: every
            # other origin was already refused above.
            if total_cost is not None:
                raise EntryCostOnNegativeAdjustment("a negative adjustment carries no cost")
        elif total_cost is not None and total_cost <= 0:
            raise EntryCostInvalid("a total cost is above zero")
        trimmed = (note or "").strip()
        if len(trimmed) > NOTE_MAX_LENGTH:
            raise EntryNoteTooLong(f"a note has at most {NOTE_MAX_LENGTH} characters")
        return cls(
            entry_date=entry_date,
            variety_id=variety_id,
            origin=origin,
            grams=grams,
            total_cost=total_cost,
            note=trimmed or None,
            recorded_at=recorded_at,
            id=id,
        )
