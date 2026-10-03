"""Ports the catalog declares over the other hexagons and its own storage
(docs/adr/0006). No implementation lives here; `app/catalog/adapters/` implements each
one, the only place in the catalog allowed to import `app.varieties`, `app.stock` or
`app.accounts`.
"""

from __future__ import annotations

from datetime import date
from typing import Protocol

from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.header_footer import CatalogHeaderFooter
from app.catalog.domain.variety import CatalogVariety, StockStatus


class CatalogVarieties(Protocol):
    def on(self, day: date) -> list[CatalogVariety]:
        """Every variety of the business, in name-key order, with its current price on
        `day` or `None`."""
        ...

    def exists(self, variety_id: int) -> bool: ...


class CatalogStock(Protocol):
    def statuses(self, day: date) -> dict[int, StockStatus]:
        """Every variety's stock status, by variety id, as of `day`."""
        ...


class CatalogAttributesRepository(Protocol):
    def all(self) -> dict[int, CatalogAttributes]:
        """Every variety that has an attributes row, by variety id. A variety absent
        here reads as `CatalogAttributes.default()`."""
        ...

    def put(self, variety_id: int, attributes: CatalogAttributes) -> None: ...


class CatalogHeaderFooterRepository(Protocol):
    def get(self) -> CatalogHeaderFooter: ...

    def put(self, header_footer: CatalogHeaderFooter) -> None: ...
