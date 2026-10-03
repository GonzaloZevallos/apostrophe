"""`catalog_text` (CODING_STANDARDS section 5): the reference set of literal expected
strings for the Exact-text metric (emoji or none, share at 0/50/100 or none, aroma or
none, bulk or none with whole and fractional minimums, thousands, a blank header or
footer, seller `**` markers, two or more blocks), plus `None` with no entries."""

from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.header_footer import DEFAULT_FOOTER, DEFAULT_HEADER
from app.catalog.domain.text import CatalogEntry, catalog_text
from app.catalog.domain.variety import CatalogPrice
from app.shared.grams import Grams


def _entry(
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


def test_no_entries_gives_none_even_with_a_header_and_a_footer() -> None:
    assert catalog_text(DEFAULT_HEADER, DEFAULT_FOOTER, []) is None


def test_the_requests_exact_24k_gold_example() -> None:
    entry = _entry(
        "24K Gold",
        emoji="\U0001f947",
        indica_share=60,
        aroma="cítrico, mandarina dulce con fondo terroso y kush",
        list_price=11000,
        bulk_price=10000,
        bulk_minimum="10",
    )

    text = catalog_text(DEFAULT_HEADER, DEFAULT_FOOTER, [entry])

    assert text == (
        "\U0001f33f **CATÁLOGO** \U0001f33f\n\n"
        "\U0001f947 **24K Gold**\n"
        "• 60% índica / 40% sativa\n"
        "• Aroma/sabor: cítrico, mandarina dulce con fondo terroso y kush\n"
        "• Precio x gramo: $11.000\n"
        "• Desde 10 g: $10.000 c/u\n\n"
        "\U0001f4e9 Consultas y pedidos por privado."
    )


def test_no_emoji_gives_a_bare_name_line() -> None:
    entry = _entry("Blue Dream", list_price=9000)

    text = catalog_text("", "", [entry])

    assert text == "**Blue Dream**\n• Precio x gramo: $9.000"


def test_no_share_leaves_out_the_share_line() -> None:
    entry = _entry("Blue Dream", list_price=9000)

    text = catalog_text("", "", [entry])

    assert text == "**Blue Dream**\n• Precio x gramo: $9.000"


def test_share_at_0_is_written_in_full() -> None:
    entry = _entry("A", indica_share=0, list_price=1000)

    text = catalog_text("", "", [entry])

    assert text == "**A**\n• 0% índica / 100% sativa\n• Precio x gramo: $1.000"


def test_share_at_50_is_written_in_full() -> None:
    entry = _entry("A", indica_share=50, list_price=1000)

    text = catalog_text("", "", [entry])

    assert text == "**A**\n• 50% índica / 50% sativa\n• Precio x gramo: $1.000"


def test_share_at_100_is_written_in_full() -> None:
    entry = _entry("A", indica_share=100, list_price=1000)

    text = catalog_text("", "", [entry])

    assert text == "**A**\n• 100% índica / 0% sativa\n• Precio x gramo: $1.000"


def test_no_aroma_leaves_out_the_aroma_line() -> None:
    entry = _entry("Blue Dream", list_price=9000)

    text = catalog_text("", "", [entry])

    assert text == "**Blue Dream**\n• Precio x gramo: $9.000"


def test_an_aroma_is_written_on_its_own_line() -> None:
    entry = _entry("Blue Dream", aroma="dulce y terroso", list_price=9000)

    text = catalog_text("", "", [entry])

    assert text == (
        "**Blue Dream**\n• Aroma/sabor: dulce y terroso\n• Precio x gramo: $9.000"
    )


def test_no_bulk_price_leaves_out_the_bulk_line() -> None:
    entry = _entry("Blue Dream", list_price=9000)

    text = catalog_text("", "", [entry])

    assert text == "**Blue Dream**\n• Precio x gramo: $9.000"


def test_a_whole_bulk_minimum_has_no_decimals() -> None:
    entry = _entry("A", list_price=11000, bulk_price=10000, bulk_minimum="10")

    text = catalog_text("", "", [entry])

    assert text == (
        "**A**\n• Precio x gramo: $11.000\n• Desde 10 g: $10.000 c/u"
    )


def test_a_half_gram_bulk_minimum_uses_a_comma() -> None:
    entry = _entry("A", list_price=11000, bulk_price=10000, bulk_minimum="2.5")

    text = catalog_text("", "", [entry])

    assert text == (
        "**A**\n• Precio x gramo: $11.000\n• Desde 2,5 g: $10.000 c/u"
    )


def test_a_two_decimal_bulk_minimum_keeps_both_decimals() -> None:
    entry = _entry("A", list_price=11000, bulk_price=10000, bulk_minimum="2.25")

    text = catalog_text("", "", [entry])

    assert text == (
        "**A**\n• Precio x gramo: $11.000\n• Desde 2,25 g: $10.000 c/u"
    )


def test_money_under_a_thousand_has_no_separator() -> None:
    text = catalog_text("", "", [_entry("A", list_price=900)])

    assert text == "**A**\n• Precio x gramo: $900"


def test_money_in_the_thousands_gets_one_dot() -> None:
    text = catalog_text("", "", [_entry("A", list_price=11000)])

    assert text == "**A**\n• Precio x gramo: $11.000"


def test_money_in_the_millions_gets_two_dots() -> None:
    text = catalog_text("", "", [_entry("A", list_price=1000000)])

    assert text == "**A**\n• Precio x gramo: $1.000.000"


def test_a_blank_header_is_left_out_with_no_extra_blank_line() -> None:
    text = catalog_text("", "footer", [_entry("A", list_price=1000)])

    assert text == "**A**\n• Precio x gramo: $1.000\n\nfooter"


def test_a_blank_footer_is_left_out_with_no_extra_blank_line() -> None:
    text = catalog_text("header", "", [_entry("A", list_price=1000)])

    assert text == "header\n\n**A**\n• Precio x gramo: $1.000"


def test_both_blank_leaves_only_the_blocks() -> None:
    text = catalog_text("", "", [_entry("A", list_price=1000)])

    assert text == "**A**\n• Precio x gramo: $1.000"


def test_seller_markers_in_the_header_pass_through_untouched() -> None:
    text = catalog_text("**bold header**", "", [_entry("A", list_price=1000)])

    assert text == "**bold header**\n\n**A**\n• Precio x gramo: $1.000"


def test_seller_markers_in_the_aroma_pass_through_untouched() -> None:
    entry = _entry("A", list_price=1000, aroma="**very** strong")

    text = catalog_text("", "", [entry])

    assert text == (
        "**A**\n• Aroma/sabor: **very** strong\n• Precio x gramo: $1.000"
    )


def test_seller_markers_in_the_name_pass_through_untouched() -> None:
    entry = _entry("**a **b** c**", list_price=1000)

    text = catalog_text("", "", [entry])

    assert text == "****a **b** c****\n• Precio x gramo: $1.000"


def test_an_unpaired_marker_in_the_header_is_kept_as_typed() -> None:
    text = catalog_text("oops **unpaired", "", [_entry("A", list_price=1000)])

    assert text == "oops **unpaired\n\n**A**\n• Precio x gramo: $1.000"


def test_two_blocks_between_a_header_and_a_footer_are_each_blank_line_separated() -> None:
    """The enforcement artefact exercised on the shape it must reject if wrong: blocks
    joined by a single `\\n` instead of `\\n\\n`, or written out of order, would fail
    this literal comparison."""
    first = _entry("24K Gold", emoji="\U0001f947", list_price=11000)
    second = _entry("Blue Dream", indica_share=40, list_price=9000)

    text = catalog_text(DEFAULT_HEADER, DEFAULT_FOOTER, [first, second])

    assert text == (
        "\U0001f33f **CATÁLOGO** \U0001f33f\n\n"
        "\U0001f947 **24K Gold**\n"
        "• Precio x gramo: $11.000\n\n"
        "**Blue Dream**\n"
        "• 40% índica / 60% sativa\n"
        "• Precio x gramo: $9.000\n\n"
        "\U0001f4e9 Consultas y pedidos por privado."
    )


def test_entries_are_written_in_the_order_given() -> None:
    first = _entry("A", list_price=1000)
    second = _entry("B", list_price=2000)

    text = catalog_text("", "", [second, first])

    assert text == (
        "**B**\n• Precio x gramo: $2.000\n\n**A**\n• Precio x gramo: $1.000"
    )
