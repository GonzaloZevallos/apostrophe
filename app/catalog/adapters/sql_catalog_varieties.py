"""The `CatalogVarieties` port over `SqlVarieties` (CODING_STANDARDS section 1: only
modules under `app/catalog/adapters/` import `app.products`). Built for one business.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.catalog.domain.product import ArchivedCatalogProduct, CatalogPrice, CatalogProduct
from app.products.adapters.sql_products import SqlProducts
from app.products.domain.product import PriceEntry


class SqlCatalogVarieties:
    def __init__(self, session: Session, business_id: int) -> None:
        self._varieties = SqlProducts(session, business_id)

    def on(self, day: date) -> list[CatalogProduct]:
        views = []
        for variety in self._varieties.listed():
            assert variety.id is not None, "only stored varieties are read here"
            views.append(
                CatalogProduct(
                    id=variety.id,
                    name=variety.name.value,
                    price=_catalog_price(variety.current_price(day)),
                )
            )
        return views

    def archived(self) -> list[ArchivedCatalogProduct]:
        views = []
        for variety in self._varieties.archived():
            assert variety.id is not None, "only stored varieties are read here"
            views.append(ArchivedCatalogProduct(id=variety.id, name=variety.name.value))
        return views

    def exists(self, variety_id: int) -> bool:
        return self._varieties.get(variety_id) is not None

    def usable(self, variety_id: int) -> bool:
        variety = self._varieties.get(variety_id)
        return variety is not None and not variety.is_archived


def _catalog_price(entry: PriceEntry | None) -> CatalogPrice | None:
    if entry is None:
        return None
    return CatalogPrice(
        list_price=entry.list_price,
        bulk_price=entry.bulk.price if entry.bulk else None,
        bulk_minimum=entry.bulk.minimum if entry.bulk else None,
    )
