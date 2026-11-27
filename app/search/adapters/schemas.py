"""The HTTP shape of grouped search: three groups, each a list of hits."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from app.money_schema import MoneyOut
from app.products.adapters.schemas import QuantityOut
from app.search.application.ports import CustomerHit, ProductHit
from app.search.application.search import SearchResult


class SaleOut(BaseModel):
    """Placeholder: the Sales group arrives in a later part, and its list is empty."""


class CustomerHitOut(BaseModel):
    id: int
    name: str
    balance: MoneyOut

    @classmethod
    def of(cls, hit: CustomerHit) -> CustomerHitOut:
        # The domain int, as `CustomerOut.of` fills it: `MoneyOut` scales it once.
        return cls(id=hit.id, name=hit.name, balance=Decimal(hit.balance))


class ProductHitOut(BaseModel):
    id: int
    name: str
    quantity: QuantityOut

    @classmethod
    def of(cls, hit: ProductHit) -> ProductHitOut:
        return cls(id=hit.id, name=hit.name, quantity=hit.quantity.as_decimal())


class SearchOut(BaseModel):
    sales: list[SaleOut]
    customers: list[CustomerHitOut]
    products: list[ProductHitOut]

    @classmethod
    def of(cls, result: SearchResult) -> SearchOut:
        return cls(
            sales=[SaleOut() for _ in result.sales],
            customers=[CustomerHitOut.of(h) for h in result.customers],
            products=[ProductHitOut.of(h) for h in result.products],
        )
