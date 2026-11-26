"""Grouped search: Sales, Customers and Products matching one `SearchQuery` (GH-1059)."""

from __future__ import annotations

from dataclasses import dataclass

from app.search.application.ports import (
    CustomerHit,
    CustomerSearch,
    ProductHit,
    ProductSearch,
    SaleHit,
    SaleSearch,
)
from app.search.domain.query import GROUP_LIMIT, SearchQuery


@dataclass(frozen=True)
class SearchResult:
    sales: list[SaleHit]
    customers: list[CustomerHit]
    products: list[ProductHit]


def search(
    query: SearchQuery,
    sales: SaleSearch,
    customers: CustomerSearch,
    products: ProductSearch,
) -> SearchResult:
    """A short query answers three empty groups and calls no port."""
    if query.is_short:
        return SearchResult([], [], [])
    return SearchResult(
        sales.find(query, GROUP_LIMIT),
        customers.find(query, GROUP_LIMIT),
        products.find(query, GROUP_LIMIT),
    )
