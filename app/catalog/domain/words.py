"""The words the catalog text is written in (CONTEXT.md: Catalog): plain strings plus small
format callables for the lines with holes. The domain imports no translation library, so
whatever builds this value hands it over already translated; the callables receive money,
grams and shares already formatted by the domain and only place them in the line.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class CatalogWords:
    nothing_to_offer: str
    indica: Callable[[str, str], str]
    """The line of the indica and sativa shares, in that order."""
    aroma: Callable[[str], str]
    price_per_gram: Callable[[str], str]
    bulk: Callable[[str, str], str]
    """The line of the bulk minimum in grams and the bulk price, in that order."""

    def __post_init__(self) -> None:
        if self.nothing_to_offer.strip() == "":
            raise ValueError("A CatalogWords needs a non-blank nothing_to_offer line")
