"""`PUT /catalog/varieties/{variety_id}`'s use case (CONTEXT.md: Catalog attributes).
The variety is checked through `CatalogVarieties.exists` before any write (the plan's
invariant); the write replaces all four attributes in one upsert, then the use case
commits once and answers the full catalog, the same shape `read_catalog` does.
"""

from __future__ import annotations

from datetime import date

from app.catalog.application.errors import CatalogVarietyNotFound
from app.catalog.application.ports import (
    CatalogAttributesRepository,
    CatalogHeaderFooterRepository,
    CatalogPricingSettings,
    CatalogStock,
    CatalogVarieties,
)
from app.catalog.application.read_catalog import CatalogView, read_catalog
from app.catalog.domain.attributes import CatalogAttributes
from app.shared.transaction import Transaction


def write_variety_attributes(
    varieties: CatalogVarieties,
    attributes_repo: CatalogAttributesRepository,
    transaction: Transaction,
    variety_id: int,
    shown: bool,
    emoji: str | None,
    indica_share: int | None,
    aroma: str | None,
) -> None:
    """The write alone, with no catalog read after it: what the spreadsheet import needs,
    since it discards the answer."""
    if not varieties.exists(variety_id):
        raise CatalogVarietyNotFound(variety_id)
    attributes = CatalogAttributes.of(shown, emoji, indica_share, aroma)
    attributes_repo.put(variety_id, attributes)
    transaction.commit()


def set_variety_attributes(
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    header_footer_repo: CatalogHeaderFooterRepository,
    pricing_settings: CatalogPricingSettings,
    transaction: Transaction,
    variety_id: int,
    shown: bool,
    emoji: str | None,
    indica_share: int | None,
    aroma: str | None,
    today: date,
) -> CatalogView:
    write_variety_attributes(
        varieties, attributes_repo, transaction, variety_id, shown, emoji, indica_share, aroma
    )
    return read_catalog(
        varieties, stock, attributes_repo, header_footer_repo, pricing_settings, today
    )
