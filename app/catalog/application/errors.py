"""Catalog's own use-case error (CODING_STANDARDS section 9): the message names the
rule broken and the id involved, never a name, an emoji or any other typed text.
"""

from __future__ import annotations

from typing import ClassVar


class CatalogVarietyNotFound(LookupError):
    code: ClassVar[str] = "catalog.variety_not_found"

    def __init__(self, variety_id: int) -> None:
        super().__init__(f"no variety {variety_id} in the catalog")


class CatalogVarietyArchived(LookupError):
    """The variety exists but is archived, so its attributes are read-only. Code-less
    internal signal: `variety.archived` belongs to one class system-wide
    (`app.varieties.application.errors.VarietyArchived`) and this application layer
    cannot import it, so the router raises that class in its place."""

    def __init__(self, variety_id: int) -> None:
        super().__init__(f"variety {variety_id} is archived")
