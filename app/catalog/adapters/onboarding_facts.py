"""Implements the Onboarding's `CatalogFacts` port (docs/adr/0006, docs/adr/0046) for one
business: read-only, whether anything qualifies for the catalog today. Catalog never
imports the Onboarding; `app/main.py` wires this in."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.adapters.stock_status import StockStatusesFromStock
from app.catalog.application.any_qualifies import any_qualifies
from app.catalog.application.ports import CatalogPricingSettings


class SqlCatalogFacts:
    def __init__(
        self,
        session: Session,
        business_id: int,
        today: date,
        pricing_settings: CatalogPricingSettings,
    ) -> None:
        self._varieties = SqlCatalogVarieties(session, business_id)
        self._stock = StockStatusesFromStock(session, business_id)
        self._attributes = SqlCatalogAttributes(session, business_id)
        self._pricing_settings = pricing_settings
        self._today = today

    def any_qualifies(self) -> bool:
        return any_qualifies(
            self._today, self._varieties, self._stock, self._attributes, self._pricing_settings
        )
