"""`CatalogWordsSource` over the copy module's gettext catalogs (docs/adr/0050). Built once
per language when the app is created, so each catalog read is a dict lookup; the domain
gets plain strings and callables and never sees Babel.
"""

from __future__ import annotations

from babel.support import Translations

from app.catalog.domain.words import CatalogWords
from app.shared.copy import CopyCatalog, required_text
from app.shared.language import ENGLISH, Language

NOTHING_TO_OFFER = "catalog.nothing_to_offer"
INDICA = "catalog.indica_line"
AROMA = "catalog.aroma_line"
PRICE_PER_GRAM = "catalog.price_per_gram_line"
BULK = "catalog.bulk_line"


def _words(translations: Translations) -> CatalogWords:
    indica = required_text(translations, INDICA)
    aroma = required_text(translations, AROMA)
    price_per_gram = required_text(translations, PRICE_PER_GRAM)
    bulk = required_text(translations, BULK)
    return CatalogWords(
        nothing_to_offer=required_text(translations, NOTHING_TO_OFFER),
        indica=lambda share, other: indica.format(indica=share, sativa=other),
        aroma=lambda text: aroma.format(aroma=text),
        price_per_gram=lambda price: price_per_gram.format(price=price),
        bulk=lambda quantity, price: bulk.format(quantity=quantity, price=price),
    )


class BabelCatalogWords:
    def __init__(self, copy_catalog: CopyCatalog) -> None:
        self._copy_catalog = copy_catalog
        languages = copy_catalog.languages() | {ENGLISH}
        self._words = {
            language: _words(copy_catalog.translations_or_english(language))
            for language in languages
        }

    def words_for(self, language: Language) -> CatalogWords:
        if language not in self._words:
            # A language the copy had no catalog for when this was built: the copy
            # module decides what it renders (English), not this adapter.
            self._words[language] = _words(self._copy_catalog.translations_or_english(language))
        return self._words[language]
