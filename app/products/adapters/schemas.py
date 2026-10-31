from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, PlainSerializer

from app.products.domain.product import PriceEntry, Product

# Quantity go out as a JSON number; they never carry more than two decimals.
QuantityOut = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class ProductIn(BaseModel):
    name: str


class PriceEntryIn(BaseModel):
    effective_from: date
    list_price: int
    bulk_price: int | None = None
    bulk_minimum: Decimal | None = None
    vip_price: int | None = None


class PriceEntryOut(BaseModel):
    id: int
    effective_from: date
    list_price: int
    bulk_price: int | None
    bulk_minimum: QuantityOut | None
    vip_price: int | None

    @classmethod
    def of(cls, entry: PriceEntry) -> "PriceEntryOut":
        assert entry.id is not None, "only stored entries go out"
        return cls(
            id=entry.id,
            effective_from=entry.effective_from,
            list_price=entry.list_price,
            bulk_price=entry.bulk.price if entry.bulk else None,
            bulk_minimum=entry.bulk.minimum.as_decimal() if entry.bulk else None,
            vip_price=entry.vip_price,
        )


class ProductOut(BaseModel):
    id: int
    name: str
    # The price in force on the day asked for (today, unless the caller asked for
    # another day, docs/adr/0011); `null` when the product has none that day.
    current_price: PriceEntryOut | None
    archived: bool

    @classmethod
    def of(cls, product: Product, day: date) -> "ProductOut":
        assert product.id is not None, "only stored products go out"
        price = product.current_price(day)
        return cls(
            id=product.id,
            name=product.name.value,
            current_price=None if price is None else PriceEntryOut.of(price),
            archived=product.is_archived,
        )


class ProductDetailOut(ProductOut):
    """One product's page: also the one removal action it offers, worked out from history
    when it is read (`null` for an archived product)."""

    removal: Literal["delete", "archive"] | None
