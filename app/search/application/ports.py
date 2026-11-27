"""What grouped search needs from its three groups, and the hits each answers.

Every port receives the whole `SearchQuery`. An adapter never strips, folds or rewrites
the text: it passes `query.q` to the shared rules (`Customer.matches`, `name_matches` and
`search_order_key`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.search.domain.query import SearchQuery
from app.shared.quantity import Quantity


@dataclass(frozen=True)
class CustomerHit:
    id: int
    name: str
    # In the unit of the business's decimals, exactly `CustomerBalance.balance`; signed, so
    # a Credit is below 0. It is never a `Money`: that would read it at the wrong scale.
    balance: int


@dataclass(frozen=True)
class ProductHit:
    id: int
    name: str
    quantity: Quantity


@dataclass(frozen=True)
class SaleHit:
    """A Sale found by search. Its fields arrive with the Sales group part; the list
    is empty until then."""


class CustomerSearch(Protocol):
    def find(self, query: SearchQuery, limit: int) -> list[CustomerHit]: ...


class ProductSearch(Protocol):
    def find(self, query: SearchQuery, limit: int) -> list[ProductHit]: ...


class SaleSearch(Protocol):
    def find(self, query: SearchQuery, limit: int) -> list[SaleHit]: ...
