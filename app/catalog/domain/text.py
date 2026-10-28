"""The one place the catalog text is written (CONTEXT.md: Catalog; the plan's
invariant): no other module, front included, formats `$11.000`, catalog grams or
assembles a variety block.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.product import CatalogPrice
from app.catalog.domain.words import CatalogWords
from app.shared.quantity import Quantity


@dataclass(frozen=True)
class CatalogEntry:
    name: str
    attributes: CatalogAttributes
    price: CatalogPrice


def catalog_text(
    words: CatalogWords, header: str, footer: str, entries: Sequence[CatalogEntry]
) -> str | None:
    """`None` with no entries, even if the header or footer is not blank. Otherwise the
    header (if not `""`), one block per entry in the order given, the footer (if not
    `""`), every section joined by exactly one blank line."""
    if not entries:
        return None
    return _join(header, [_block(words, entry) for entry in entries], footer)


def pinned_catalog_text(
    words: CatalogWords, header: str, footer: str, entries: Sequence[CatalogEntry]
) -> str:
    """What Telegram needs (#10): `catalog_text`'s text, or — when nothing qualifies —
    the header, the words' nothing-to-offer line and the footer, so the pin
    always has something to show. `GET /catalog` and Copiar keep `catalog_text`'s own
    `None` and their own empty state; this is the only other caller of `_join`."""
    text = catalog_text(words, header, footer, entries)
    if text is not None:
        return text
    return _join(header, [words.nothing_to_offer], footer)


def _join(header: str, blocks: Sequence[str], footer: str) -> str:
    """The one place that lays out header, blocks and footer (the plan's invariant):
    every section blank-line separated, a blank header or footer left out."""
    sections: list[str] = []
    if header != "":
        sections.append(header)
    sections.extend(blocks)
    if footer != "":
        sections.append(footer)
    return "\n\n".join(sections)


def _block(words: CatalogWords, entry: CatalogEntry) -> str:
    lines = [_name_line(entry)]
    if entry.attributes.indica_share is not None:
        percent = entry.attributes.indica_share.percent
        lines.append(words.indica(str(percent), str(100 - percent)))
    if entry.attributes.aroma is not None:
        lines.append(words.aroma(entry.attributes.aroma.text))
    lines.append(words.price_per_gram(_money(entry.price.list_price)))
    if entry.price.bulk_price is not None and entry.price.bulk_minimum is not None:
        lines.append(
            words.bulk(_quantity(entry.price.bulk_minimum), _money(entry.price.bulk_price))
        )
    return "\n".join(lines)


def _name_line(entry: CatalogEntry) -> str:
    if entry.attributes.emoji is not None:
        return f"{entry.attributes.emoji.value} **{entry.name}**"
    return f"**{entry.name}**"


def _money(amount: int) -> str:
    """`$11.000`: a dollar sign, then the whole pesos with a dot every three digits.
    No `float`, `round()` or `Decimal`."""
    return "$" + f"{amount:,}".replace(",", ".")


def _quantity(quantity: Quantity) -> str:
    """`10 g` when whole; otherwise a comma with the trailing zero dropped: `2,5 g`,
    `2,25 g`. Reads `Quantity.hundredths`, never a float."""
    whole, remainder = divmod(quantity.hundredths, 100)
    if remainder == 0:
        return f"{whole} g"
    decimal = f"{remainder:02d}".rstrip("0")
    return f"{whole},{decimal} g"
