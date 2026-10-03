"""The one place the catalog text is written (CONTEXT.md: Catalog; the plan's
invariant): no other module, front included, formats `$11.000`, catalog grams or
assembles a variety block.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.variety import CatalogPrice
from app.shared.grams import Grams


@dataclass(frozen=True)
class CatalogEntry:
    name: str
    attributes: CatalogAttributes
    price: CatalogPrice


def catalog_text(header: str, footer: str, entries: Sequence[CatalogEntry]) -> str | None:
    """`None` with no entries, even if the header or footer is not blank. Otherwise the
    header (if not `""`), one block per entry in the order given, the footer (if not
    `""`), every section joined by exactly one blank line."""
    if not entries:
        return None
    sections: list[str] = []
    if header != "":
        sections.append(header)
    sections.extend(_block(entry) for entry in entries)
    if footer != "":
        sections.append(footer)
    return "\n\n".join(sections)


def _block(entry: CatalogEntry) -> str:
    lines = [_name_line(entry)]
    if entry.attributes.indica_share is not None:
        percent = entry.attributes.indica_share.percent
        lines.append(f"• {percent}% índica / {100 - percent}% sativa")
    if entry.attributes.aroma is not None:
        lines.append(f"• Aroma/sabor: {entry.attributes.aroma.text}")
    lines.append(f"• Precio x gramo: {_money(entry.price.list_price)}")
    if entry.price.bulk_price is not None and entry.price.bulk_minimum is not None:
        lines.append(
            f"• Desde {_grams(entry.price.bulk_minimum)}: "
            f"{_money(entry.price.bulk_price)} c/u"
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


def _grams(grams: Grams) -> str:
    """`10 g` when whole; otherwise a comma with the trailing zero dropped: `2,5 g`,
    `2,25 g`. Reads `Grams.hundredths`, never a float."""
    whole, remainder = divmod(grams.hundredths, 100)
    if remainder == 0:
        return f"{whole} g"
    decimal = f"{remainder:02d}".rstrip("0")
    return f"{whole},{decimal} g"
