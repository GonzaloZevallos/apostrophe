"""The `CatalogVarieties` port over `SqlVarieties` (CODING_STANDARDS section 1: only
modules under `app/catalog/adapters/` import `app.varieties`). Built for one business.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.catalog.domain.variety import CatalogPrice, CatalogVariety
from app.varieties.adapters.sql_varieties import SqlVarieties
from app.varieties.domain.variety import PriceEntry


class SqlCatalogVarieties:
    def __init__(self, session: Session, business_id: int) -> None:
        self._varieties = SqlVarieties(session, business_id)

    def on(self, day: date) -> list[CatalogVariety]:
        views = []
        for variety in self._varieties.all():
            assert variety.id is not None, "only stored varieties are read here"
            views.append(
                CatalogVariety(
                    id=variety.id,
                    name=variety.name.value,
                    price=_catalog_price(variety.current_price(day)),
                )
            )
        return views

    def exists(self, variety_id: int) -> bool:
        return self._varieties.get(variety_id) is not None


def _catalog_price(entry: PriceEntry | None) -> CatalogPrice | None:
    if entry is None:
        return None
    return CatalogPrice(
        list_price=entry.list_price,
        bulk_price=entry.bulk.price if entry.bulk else None,
        bulk_minimum=entry.bulk.minimum if entry.bulk else None,
    )
