"""`catalog.domain.text._money` (CODING_STANDARDS section 5): the catalog's own money style,
the symbol attached to the figure, a dot every three digits and exactly the business's
decimals after a comma, from `Money` in integer arithmetic. The seam is the catalog text
functions, so the table also runs through them."""

import pytest

from app.catalog.domain.text import _money, catalog_text
from app.catalog.domain.words import CatalogWords
from app.pinned_catalog.domain.bold import telegram_bold
from app.shared.money import Money, MoneyFormat
from tests.catalog.reference_texts import entry

WORDS = CatalogWords(
    nothing_to_offer="Nothing.",
    indica=lambda indica, sativa: f"{indica}/{sativa}",
    aroma=lambda aroma: aroma,
    price_per_gram=lambda price: f"Price: {price}",
    bulk=lambda quantity, price: f"From {quantity}: {price}",
)


@pytest.mark.parametrize(
    ("hundredths", "symbol", "decimals", "expected"),
    [
        (0, "$", 0, "$0"),
        (1_100_000, "$", 0, "$11.000"),
        (1_100_000, "$", 1, "$11.000,0"),
        (1_100_050, "US$", 1, "US$11.000,5"),
        (1_100_050, "US$", 2, "US$11.000,50"),
        (1_100_000, "US$", 2, "US$11.000,00"),
        (5, "$", 2, "$0,05"),
        (1_050, "$", 1, "$10,5"),
        (-1_100_050, "US$", 2, "US$-11.000,50"),
        (-90_000, "$", 0, "$-900"),
        (123_456_789_00, "$", 0, "$123.456.789"),
        (123_456_789_99, "EUR", 2, "EUR123.456.789,99"),
    ],
)
def test_money_writes_the_symbol_the_dots_and_exactly_the_decimals(
    hundredths: int, symbol: str, decimals: int, expected: str
) -> None:
    assert _money(Money(hundredths), MoneyFormat(symbol, decimals)) == expected


@pytest.mark.parametrize("symbol", ["_", "[", "\\", "`", "*", "R$"])
def test_a_symbol_with_markup_characters_is_written_as_given_and_bold_pairing_is_untouched(
    symbol: str,
) -> None:
    text = catalog_text(
        WORDS,
        MoneyFormat(symbol, 0),
        "",
        "",
        [entry("A", list_price=11000, bulk_price=10000, bulk_minimum="10")],
    )

    assert text == f"**A**\nPrice: {symbol}11.000\nFrom 10 g: {symbol}10.000"
    assert telegram_bold(text) == (f"A\nPrice: {symbol}11.000\nFrom 10 g: {symbol}10.000", [(0, 1)])
