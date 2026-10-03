"""Catalog's own use-case error (CODING_STANDARDS section 9): the message names the
rule broken and the id involved, never a name, an emoji or any other typed text.
"""

from __future__ import annotations

from typing import ClassVar


class CatalogVarietyNotFound(LookupError):
    code: ClassVar[str] = "catalog.variety_not_found"

    def __init__(self, variety_id: int) -> None:
        super().__init__(f"no variety {variety_id} in the catalog")
