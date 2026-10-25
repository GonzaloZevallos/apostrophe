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
from app.catalog.domain.variety import ArchivedCatalogVariety, CatalogVariety, StockStatus
from app.catalog.domain.words import CatalogWords
from app.shared.language import Language
from app.shared.pricing_settings import PricingSettings


class CatalogVarieties(Protocol):
    def on(self, day: date) -> list[CatalogVariety]:
        """Every variety of the business, in name-key order, with its current price on
        `day` or `None`."""
        ...

    def archived(self) -> list[ArchivedCatalogVariety]:
        """Every archived variety of the business, in name-key order."""
        ...

    def exists(self, variety_id: int) -> bool:
        """The variety is this business's, archived or not."""
        ...

    def usable(self, variety_id: int) -> bool:
        """The variety is this business's and not archived: only such a variety takes
        attributes (docs/adr/0032)."""
        ...


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


class CatalogPricingSettings(Protocol):
    def current(self) -> PricingSettings:
        """The business's pricing switches. Read once per catalog read."""
        ...


class CatalogWordsSource(Protocol):
    def words_for(self, language: Language) -> CatalogWords:
        """The fixed lines of the catalog text in `language`, English for a language the
        copy has no catalog for."""
        ...
