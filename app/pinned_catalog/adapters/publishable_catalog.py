"""What Telegram needs (plan, "Catalog (a small change)"): `publishable_text` builds it
the same way `GET /catalog` builds its own text, over the catalog's own ports and
`read_publishable_text`. The only module under `app/pinned_catalog/` allowed to import
`app.catalog` (CODING_STANDARDS §1: only `adapters/` reaches another hexagon).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date

from sqlalchemy.orm import Session

from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.adapters.sql_header_footer import SqlCatalogHeaderFooter
from app.catalog.adapters.stock_status import StockStatusesFromStock
from app.catalog.application.ports import CatalogPricingSettings
from app.catalog.application.read_catalog import read_publishable_text


def publishable_text(
    session: Session,
    business_id: int,
    today: date,
    pricing_settings: Callable[[Session, int], CatalogPricingSettings],
) -> str:
    varieties = SqlCatalogVarieties(session, business_id)
    stock = StockStatusesFromStock(session, business_id)
    attributes = SqlCatalogAttributes(session, business_id)
    header_footer = SqlCatalogHeaderFooter(session, business_id)
    return read_publishable_text(
        varieties,
        stock,
        attributes,
        header_footer,
        pricing_settings(session, business_id),
        today,
    )
