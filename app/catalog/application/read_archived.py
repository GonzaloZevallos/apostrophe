"""`GET /catalog/archived`'s use case (docs/adr/0032): the stored catalog attributes of
every archived variety of the business, by name. The one read the archived page and the
Archivadas rows share; `GET /catalog` never lists an archived variety.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.catalog.application.ports import CatalogAttributesRepository, CatalogVarieties
from app.catalog.domain.attributes import CatalogAttributes


@dataclass(frozen=True)
class ArchivedCatalogVarietyView:
    variety_id: int
    name: str
    shown: bool
    emoji: str | None
    indica_share: int | None
    aroma: str | None


def read_archived(
    varieties: CatalogVarieties, attributes_repo: CatalogAttributesRepository
) -> list[ArchivedCatalogVarietyView]:
    """A variety with no attributes row reads as the defaults (shown, nothing else)."""
    attributes_by_id = attributes_repo.all()
    views = []
    for variety in varieties.archived():
        attributes = attributes_by_id.get(variety.id, CatalogAttributes.default())
        views.append(
            ArchivedCatalogVarietyView(
                variety_id=variety.id,
                name=variety.name,
                shown=attributes.shown,
                emoji=attributes.emoji.value if attributes.emoji is not None else None,
                indica_share=(
                    attributes.indica_share.percent if attributes.indica_share is not None else None
                ),
                aroma=attributes.aroma.text if attributes.aroma is not None else None,
            )
        )
    return views
