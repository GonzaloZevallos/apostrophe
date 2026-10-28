"""A variety as the catalog sees it today (CONTEXT.md: Catalog, Stock status): its
current price, if any, and whether it is in or out of today's text.

`catalog_state` is the one place that decision is made: it never compares grams, reads
a stock entry or a draw itself, only the `StockStatus` the `CatalogStock` port already
computed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.catalog.domain.attributes import CatalogAttributes
from app.shared.quantity import Quantity

StockStatus = Literal["no_entries", "sold_out", "low", "ok"]
CatalogState = Literal["in", "hidden", "no_price", "sold_out", "no_entries"]


@dataclass(frozen=True)
class CatalogPrice:
    """A variety's current price entry, as the catalog needs it: a bulk price and a
    bulk minimum go together, or neither is given."""

    list_price: int
    bulk_price: int | None
    bulk_minimum: Quantity | None

    def __post_init__(self) -> None:
        if (self.bulk_price is None) != (self.bulk_minimum is None):
            raise ValueError("a catalog price has both bulk fields or neither")


@dataclass(frozen=True)
class CatalogVariety:
    id: int
    name: str
    price: CatalogPrice | None


@dataclass(frozen=True)
class ArchivedCatalogVariety:
    """An archived variety, named only: its stored attributes are read apart from the
    varieties (docs/adr/0032)."""

    id: int
    name: str


def catalog_state(
    attributes: CatalogAttributes, price: CatalogPrice | None, stock_status: StockStatus
) -> CatalogState:
    """The first that fits, in order: hidden, no price today, the stock status when it
    is `sold_out` or `no_entries`, otherwise `in` (covers `low` and `ok`)."""
    if not attributes.shown:
        return "hidden"
    if price is None:
        return "no_price"
    if stock_status in ("sold_out", "no_entries"):
        return stock_status
    return "in"
