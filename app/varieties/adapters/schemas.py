from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

from app.varieties.domain.variety import PriceEntry, Variety

# Grams go out as a JSON number; they never carry more than two decimals.
GramsOut = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class VarietyIn(BaseModel):
    name: str


class PriceEntryIn(BaseModel):
    effective_from: date
    list_price: int
    bulk_price: int | None = None
    bulk_minimum: Decimal | None = None


class PriceEntryOut(BaseModel):
    id: int
    effective_from: date
    list_price: int
    bulk_price: int | None
    bulk_minimum: GramsOut | None

    @classmethod
    def of(cls, entry: PriceEntry) -> "PriceEntryOut":
        assert entry.id is not None, "only stored entries go out"
        return cls(
            id=entry.id,
            effective_from=entry.effective_from,
            list_price=entry.list_price,
            bulk_price=entry.bulk.price if entry.bulk else None,
            bulk_minimum=entry.bulk.minimum.as_decimal() if entry.bulk else None,
        )


class VarietyOut(BaseModel):
    id: int
    name: str
    # The price in force on the day asked for (today, unless the caller asked for
    # another day, docs/adr/0011); `null` when the variety has none that day.
    current_price: PriceEntryOut | None
    archived: bool

    @classmethod
    def of(cls, variety: Variety, day: date) -> "VarietyOut":
        assert variety.id is not None, "only stored varieties go out"
        price = variety.current_price(day)
        return cls(
            id=variety.id,
            name=variety.name.value,
            current_price=None if price is None else PriceEntryOut.of(price),
            archived=variety.is_archived,
        )
