"""`PUT /catalog/header-footer`'s use case (CONTEXT.md: Catalog header and footer).
Every business already has a row, seeded when it opened; this replaces it and commits
once, then answers the full catalog, the same shape `read_catalog` does.
"""

from __future__ import annotations

from datetime import date

from app.catalog.application.ports import (
    CatalogAttributesRepository,
    CatalogHeaderFooterRepository,
    CatalogStock,
    CatalogVarieties,
)
from app.catalog.application.read_catalog import CatalogView, read_catalog
from app.catalog.domain.header_footer import CatalogHeaderFooter
from app.shared.transaction import Transaction


def set_header_footer(
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    header_footer_repo: CatalogHeaderFooterRepository,
    transaction: Transaction,
    header: str,
    footer: str,
    today: date,
) -> CatalogView:
    header_footer_repo.put(CatalogHeaderFooter.of(header, footer))
    transaction.commit()
    return read_catalog(varieties, stock, attributes_repo, header_footer_repo, today)
