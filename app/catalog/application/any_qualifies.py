"""Whether anything of the business's catalog qualifies today (docs/adr/0046): the answer
the Onboarding's `CatalogFacts` port gives. It is built only on `read_catalog._qualify`,
the one loop `read_catalog` and `read_publishable_text` run, so it can never disagree
with what `GET /catalog` would send."""

from __future__ import annotations

from datetime import date

from app.catalog.application.ports import (
    CatalogAttributesRepository,
    CatalogPricingSettings,
    CatalogStock,
    CatalogVarieties,
)
from app.catalog.application.read_catalog import _qualify


def any_qualifies(
    today: date,
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    pricing_settings: CatalogPricingSettings,
) -> bool:
    _, entries = _qualify(varieties, stock, attributes_repo, pricing_settings, today)
    return len(entries) > 0
