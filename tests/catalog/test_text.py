"""`catalog_text` and `pinned_catalog_text` (CODING_STANDARDS section 5) over a hand-built
English `CatalogWords`: the reference set of literal strings lives in `reference_texts`."""

import pytest

from app.catalog.domain.text import catalog_text, pinned_catalog_text
from app.catalog.domain.words import CatalogWords
from tests.catalog.reference_texts import CASES, Case, entry

ENGLISH_WORDS = CatalogWords(
    nothing_to_offer="Nothing to offer for now.",
    indica=lambda indica, sativa: f"• {indica}% indica / {sativa}% sativa",
    aroma=lambda aroma: f"• Aroma/flavor: {aroma}",
    price_per_gram=lambda price: f"• Price per gram: {price}",
    bulk=lambda grams, price: f"• From {grams}: {price} each",
)


@pytest.mark.parametrize("case", CASES, ids=lambda case: case.name)
def test_catalog_text_writes_the_reference_literal(case: Case) -> None:
    assert catalog_text(ENGLISH_WORDS, case.header, case.footer, case.entries) == case.expected


@pytest.mark.parametrize("case", CASES, ids=lambda case: case.name)
def test_pinned_catalog_text_writes_the_reference_literal(case: Case) -> None:
    expected = case.expected if case.expected is not None else case.expected_pinned
    assert pinned_catalog_text(ENGLISH_WORDS, case.header, case.footer, case.entries) == expected


def test_words_with_reordered_holes_reorder_the_line_and_keep_the_formatted_values() -> None:
    words = CatalogWords(
        nothing_to_offer="Nada.",
        indica=lambda indica, sativa: f"{sativa}% sativa | {indica}% indica",
        aroma=lambda aroma: f"{aroma} <- aroma",
        price_per_gram=lambda price: f"{price} por gramo",
        bulk=lambda grams, price: f"{price} c/u desde {grams}",
    )
    full = entry(
        "A",
        indica_share=60,
        aroma="x",
        list_price=11000,
        bulk_price=9000,
        bulk_minimum="2.5",
    )

    assert catalog_text(words, "", "", [full]) == (
        "**A**\n40% sativa | 60% indica\nx <- aroma\n$11.000 por gramo\n$9.000 c/u desde 2,5 g"
    )
    assert pinned_catalog_text(words, "", "", []) == "Nada."


@pytest.mark.parametrize("blank", ["", "   ", "\n"])
def test_catalog_words_refuse_a_blank_nothing_to_offer_line(blank: str) -> None:
    with pytest.raises(ValueError):
        CatalogWords(
            nothing_to_offer=blank,
            indica=lambda a, b: "",
            aroma=lambda a: "",
            price_per_gram=lambda a: "",
            bulk=lambda a, b: "",
        )
