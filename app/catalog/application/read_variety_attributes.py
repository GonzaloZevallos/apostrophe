"""`GET /catalog/varieties/{variety_id}`'s use case (docs/adr/0032, amendment): the
stored catalog attributes of one variety of the business, archived or not, as plain
facts. It builds no catalog text, writes nothing and unlocks nothing; the archived
variety's attributes stay editable nowhere.
"""

from __future__ import annotations

from app.catalog.application.errors import CatalogVarietyNotFound
from app.catalog.application.ports import CatalogAttributesRepository, CatalogVarieties
from app.catalog.domain.attributes import CatalogAttributes


def read_variety_attributes(
    varieties: CatalogVarieties,
    attributes_repo: CatalogAttributesRepository,
    variety_id: int,
) -> CatalogAttributes:
    if not varieties.exists(variety_id):
        raise CatalogVarietyNotFound(variety_id)
    stored = attributes_repo.for_variety(variety_id)
    return stored if stored is not None else CatalogAttributes.default()
