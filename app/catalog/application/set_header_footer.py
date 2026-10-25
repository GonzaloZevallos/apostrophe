"""`PUT /catalog/header-footer`'s use case (CONTEXT.md: Catalog header and footer).
Every business already has a row, seeded when it opened; this replaces it and commits
once, then answers the full catalog, the same shape `read_catalog` does.
"""

from __future__ import annotations

from datetime import date

from app.catalog.application.ports import (
    CatalogAttributesRepository,
    CatalogHeaderFooterRepository,
    CatalogLanguage,
    CatalogPricingSettings,
    CatalogStock,
    CatalogVarieties,
    CatalogWordsSource,
)
from app.catalog.application.read_catalog import CatalogView, read_catalog
from app.catalog.domain.header_footer import CatalogHeaderFooter
from app.shared.transaction import Transaction


def write_header_footer(
    header_footer_repo: CatalogHeaderFooterRepository,
    transaction: Transaction,
    header: str,
    footer: str,
) -> None:
    """The write alone, with no catalog read after it: what the spreadsheet import needs,
    since it discards the answer."""
    header_footer_repo.put(CatalogHeaderFooter.of(header, footer))
    transaction.commit()


def set_header_footer(
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    header_footer_repo: CatalogHeaderFooterRepository,
    pricing_settings: CatalogPricingSettings,
    words: CatalogWordsSource,
    language: CatalogLanguage,
    business_id: int,
    transaction: Transaction,
    header: str,
    footer: str,
    today: date,
) -> CatalogView:
    write_header_footer(header_footer_repo, transaction, header, footer)
    return read_catalog(
        varieties,
        stock,
        attributes_repo,
        header_footer_repo,
        pricing_settings,
        words,
        language,
        business_id,
        today,
    )
