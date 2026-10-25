"""The reference set of literal expected strings for the Exact-text metric (catalog.md):
emoji or none, share at 0/50/100 or none, aroma or none, bulk or none with whole and
fractional minimums, thousands, a blank header or footer, seller `**` markers, two or more
blocks, plus the empty pinned case. Run with a hand-built English `CatalogWords` and with
the one the copy module builds, which must write the same bytes."""

from __future__ import annotations

from dataclasses import dataclass

from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.header_footer import DEFAULT_FOOTER, DEFAULT_HEADER
from app.catalog.domain.text import CatalogEntry
from app.catalog.domain.variety import CatalogPrice
from app.shared.grams import Grams


def entry(
    name: str,
    *,
    emoji: str | None = None,
    indica_share: int | None = None,
    aroma: str | None = None,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: str | None = None,
) -> CatalogEntry:
    attributes = CatalogAttributes.of(
        shown=True, emoji=emoji, indica_share=indica_share, aroma=aroma
    )
    price = CatalogPrice(
        list_price=list_price,
        bulk_price=bulk_price,
        bulk_minimum=Grams.of(bulk_minimum) if bulk_minimum is not None else None,
    )
    return CatalogEntry(name=name, attributes=attributes, price=price)


@dataclass(frozen=True)
class Case:
    name: str
    header: str
    footer: str
    entries: list[CatalogEntry]
    expected: str | None
    """What `catalog_text` writes; what `pinned_catalog_text` writes too, but with no
    entries, where `expected_pinned` is the empty case."""
    expected_pinned: str | None = None


NOTHING = "Nothing to offer for now."
BLANK_BLOCK = "**A**\n• Price per gram: $1.000"

CASES = [
    Case(
        "no entries",
        DEFAULT_HEADER,
        DEFAULT_FOOTER,
        [],
        None,
        f"{DEFAULT_HEADER}\n\n{NOTHING}\n\n{DEFAULT_FOOTER}",
    ),
    Case("no entries and no header or footer", "", "", [], None, NOTHING),
    Case(
        "a stored Spanish header and footer",
        "\U0001f33f **CATÁLOGO** \U0001f33f",
        "\U0001f4e9 Consultas y pedidos por privado.",
        [entry("A", list_price=1000)],
        "\U0001f33f **CATÁLOGO** \U0001f33f\n\n"
        + BLANK_BLOCK
        + "\n\n\U0001f4e9 Consultas y pedidos por privado.",
    ),
    Case(
        "the 24K Gold example",
        DEFAULT_HEADER,
        DEFAULT_FOOTER,
        [
            entry(
                "24K Gold",
                emoji="\U0001f947",
                indica_share=60,
                aroma="cítrico, mandarina dulce con fondo terroso y kush",
                list_price=11000,
                bulk_price=10000,
                bulk_minimum="10",
            )
        ],
        "\U0001f33f **CATALOG** \U0001f33f\n\n"
        "\U0001f947 **24K Gold**\n"
        "• 60% indica / 40% sativa\n"
        "• Aroma/flavor: cítrico, mandarina dulce con fondo terroso y kush\n"
        "• Price per gram: $11.000\n"
        "• From 10 g: $10.000 each\n\n"
        "\U0001f4e9 Questions and orders by private message.",
    ),
    Case(
        "no emoji, share, aroma or bulk",
        "",
        "",
        [entry("Blue Dream", list_price=9000)],
        "**Blue Dream**\n• Price per gram: $9.000",
    ),
    Case(
        "share at 0",
        "",
        "",
        [entry("A", indica_share=0, list_price=1000)],
        "**A**\n• 0% indica / 100% sativa\n• Price per gram: $1.000",
    ),
    Case(
        "share at 50",
        "",
        "",
        [entry("A", indica_share=50, list_price=1000)],
        "**A**\n• 50% indica / 50% sativa\n• Price per gram: $1.000",
    ),
    Case(
        "share at 100",
        "",
        "",
        [entry("A", indica_share=100, list_price=1000)],
        "**A**\n• 100% indica / 0% sativa\n• Price per gram: $1.000",
    ),
    Case(
        "an aroma",
        "",
        "",
        [entry("Blue Dream", aroma="dulce y terroso", list_price=9000)],
        "**Blue Dream**\n• Aroma/flavor: dulce y terroso\n• Price per gram: $9.000",
    ),
    Case(
        "a whole bulk minimum",
        "",
        "",
        [entry("A", list_price=11000, bulk_price=10000, bulk_minimum="10")],
        "**A**\n• Price per gram: $11.000\n• From 10 g: $10.000 each",
    ),
    Case(
        "a half gram bulk minimum",
        "",
        "",
        [entry("A", list_price=11000, bulk_price=10000, bulk_minimum="2.5")],
        "**A**\n• Price per gram: $11.000\n• From 2,5 g: $10.000 each",
    ),
    Case(
        "a two decimal bulk minimum",
        "",
        "",
        [entry("A", list_price=11000, bulk_price=10000, bulk_minimum="2.25")],
        "**A**\n• Price per gram: $11.000\n• From 2,25 g: $10.000 each",
    ),
    Case(
        "money under a thousand",
        "",
        "",
        [entry("A", list_price=900)],
        "**A**\n• Price per gram: $900",
    ),
    Case(
        "money in the thousands",
        "",
        "",
        [entry("A", list_price=11000)],
        "**A**\n• Price per gram: $11.000",
    ),
    Case(
        "money in the millions",
        "",
        "",
        [entry("A", list_price=1000000)],
        "**A**\n• Price per gram: $1.000.000",
    ),
    Case("a blank header", "", "footer", [entry("A", list_price=1000)], BLANK_BLOCK + "\n\nfooter"),
    Case("a blank footer", "header", "", [entry("A", list_price=1000)], "header\n\n" + BLANK_BLOCK),
    Case(
        "seller markers in the header",
        "**bold header**",
        "",
        [entry("A", list_price=1000)],
        "**bold header**\n\n" + BLANK_BLOCK,
    ),
    Case(
        "seller markers in the aroma",
        "",
        "",
        [entry("A", list_price=1000, aroma="**very** strong")],
        "**A**\n• Aroma/flavor: **very** strong\n• Price per gram: $1.000",
    ),
    Case(
        "seller markers in the name",
        "",
        "",
        [entry("**a **b** c**", list_price=1000)],
        "****a **b** c****\n• Price per gram: $1.000",
    ),
    Case(
        "an unpaired marker in the header",
        "oops **unpaired",
        "",
        [entry("A", list_price=1000)],
        "oops **unpaired\n\n" + BLANK_BLOCK,
    ),
    Case(
        "two blocks between a header and a footer",
        DEFAULT_HEADER,
        DEFAULT_FOOTER,
        [
            entry("24K Gold", emoji="\U0001f947", list_price=11000),
            entry("Blue Dream", indica_share=40, list_price=9000),
        ],
        "\U0001f33f **CATALOG** \U0001f33f\n\n"
        "\U0001f947 **24K Gold**\n"
        "• Price per gram: $11.000\n\n"
        "**Blue Dream**\n"
        "• 40% indica / 60% sativa\n"
        "• Price per gram: $9.000\n\n"
        "\U0001f4e9 Questions and orders by private message.",
    ),
    Case(
        "entries in the order given",
        "",
        "",
        [entry("B", list_price=2000), entry("A", list_price=1000)],
        "**B**\n• Price per gram: $2.000\n\n**A**\n• Price per gram: $1.000",
    ),
]
