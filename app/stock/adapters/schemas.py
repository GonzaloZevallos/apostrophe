"""The HTTP shapes of a stock entry. Bare: no pydantic length or value constraint, so
every rule stays the domain's and its message is a fixed string (ADR-0005). Grams are
typed `Decimal` here and become `Grams` only through `Grams.of`, at the router; every
grams value out uses the shared `GramsOut` (CODING_STANDARDS: no second grams format).
"""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.stock.domain.costing import cost_per_gram
from app.stock.domain.entry import Origin, StockEntry
from app.varieties.adapters.schemas import GramsOut

# A bare `date` inside `EntryIn`/`EntryOut` would otherwise resolve to the field named
# `date`, not the type (the same trap `app.sales.adapters.schemas.SaleDate` documents).
EntryDate = date


class EntryIn(BaseModel):
    date: EntryDate | None = None
    variety_id: int
    origin: Origin
    grams: Decimal
    total_cost: int | None = None
    note: str | None = None


class EntryOut(BaseModel):
    id: int
    date: EntryDate
    variety_id: int
    origin: Origin
    grams: GramsOut
    total_cost: int | None
    cost_per_gram: int | None
    note: str | None

    @classmethod
    def of(cls, entry: StockEntry) -> "EntryOut":
        assert entry.id is not None, "only stored entries go out"
        total_cost = entry.total_cost
        per_gram = (
            cost_per_gram(total_cost, entry.grams)
            if total_cost is not None and entry.grams.is_positive
            else None
        )
        return cls(
            id=entry.id,
            date=entry.entry_date,
            variety_id=entry.variety_id,
            origin=entry.origin,
            grams=entry.grams.as_decimal(),
            total_cost=entry.total_cost,
            cost_per_gram=per_gram,
            note=entry.note,
        )
