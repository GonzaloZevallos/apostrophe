"""`GET /catalog`'s use case (CONTEXT.md: Catalog): every variety of the business with
its catalog state, and the text built from the ones that qualify. Computed fresh from
today's current prices and stock status, nothing stored (the plan's invariant).
"""

from __future__ import annotations

from dataclasses import dataclass
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
from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.text import CatalogEntry, catalog_text, pinned_catalog_text
from app.catalog.domain.product import CatalogPrice, CatalogState, catalog_state


@dataclass(frozen=True)
class CatalogVarietyView:
    id: int
    name: str
    emoji: str | None
    indica_share: int | None
    aroma: str | None
    shown: bool
    state: CatalogState


@dataclass(frozen=True)
class CatalogView:
    text: str | None
    header: str
    footer: str
    varieties: list[CatalogVarietyView]


def _qualify(
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    pricing_settings: CatalogPricingSettings,
    today: date,
) -> tuple[list[CatalogVarietyView], list[CatalogEntry]]:
    """Every variety with its catalog state, and the entries of the ones "in" — the one
    loop `read_catalog` and `read_publishable_text` both run, so a variety that
    qualifies for one always qualifies for the other."""
    all_varieties = varieties.on(today)
    attributes_by_id = attributes_repo.all()
    statuses = stock.statuses(today)
    is_bulk_pricing = pricing_settings.current().is_bulk_pricing

    views: list[CatalogVarietyView] = []
    entries: list[CatalogEntry] = []
    for variety in all_varieties:
        attributes = attributes_by_id.get(variety.id, CatalogAttributes.default())
        status = statuses.get(variety.id, "no_entries")
        state = catalog_state(attributes, variety.price, status)
        views.append(
            CatalogVarietyView(
                id=variety.id,
                name=variety.name,
                emoji=attributes.emoji.value if attributes.emoji is not None else None,
                indica_share=(
                    attributes.indica_share.percent if attributes.indica_share is not None else None
                ),
                aroma=attributes.aroma.text if attributes.aroma is not None else None,
                shown=attributes.shown,
                state=state,
            )
        )
        if state == "in":
            assert variety.price is not None, "a variety 'in' the catalog has a price"
            entries.append(
                CatalogEntry(
                    name=variety.name,
                    attributes=attributes,
                    price=_shown_price(variety.price, is_bulk_pricing),
                )
            )
    return views, entries


def _shown_price(price: CatalogPrice, is_bulk_pricing: bool) -> CatalogPrice:
    """The price as the text may show it: the bulk line only while Precio por cantidad
    is on (CONTEXT.md: Bulk price). The VIP price is not part of `CatalogPrice` at all."""
    if is_bulk_pricing:
        return price
    return CatalogPrice(list_price=price.list_price, bulk_price=None, bulk_minimum=None)


def read_catalog(
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    header_footer_repo: CatalogHeaderFooterRepository,
    pricing_settings: CatalogPricingSettings,
    words: CatalogWordsSource,
    language: CatalogLanguage,
    business_id: int,
    today: date,
) -> CatalogView:
    views, entries = _qualify(varieties, stock, attributes_repo, pricing_settings, today)
    header_footer = header_footer_repo.get()
    text = catalog_text(
        words.words_for(language.language_of(business_id)),
        header_footer.header,
        header_footer.footer,
        entries,
    )
    return CatalogView(
        text=text, header=header_footer.header, footer=header_footer.footer, varieties=views
    )


def read_publishable_text(
    varieties: CatalogVarieties,
    stock: CatalogStock,
    attributes_repo: CatalogAttributesRepository,
    header_footer_repo: CatalogHeaderFooterRepository,
    pricing_settings: CatalogPricingSettings,
    words: CatalogWordsSource,
    language: CatalogLanguage,
    business_id: int,
    today: date,
) -> str:
    """What Telegram needs (#10): `pinned_catalog_text` over the same qualification
    `read_catalog` uses, so a variety that counts for one always counts for the other."""
    _, entries = _qualify(varieties, stock, attributes_repo, pricing_settings, today)
    header_footer = header_footer_repo.get()
    return pinned_catalog_text(
        words.words_for(language.language_of(business_id)),
        header_footer.header,
        header_footer.footer,
        entries,
    )
