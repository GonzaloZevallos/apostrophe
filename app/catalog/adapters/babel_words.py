"""`CatalogWordsSource` over the copy module's gettext catalogs (docs/adr/0050). Built once
per language when the app is created, so each catalog read is a dict lookup; the domain
gets plain strings and callables and never sees Babel.
"""

from __future__ import annotations

from babel.support import Translations

from app.catalog.domain.words import CatalogWords
from app.shared.copy import CopyCatalog
from app.shared.language import ENGLISH, Language

NOTHING_TO_OFFER = "catalog.nothing_to_offer"
INDICA = "catalog.indica_line"
AROMA = "catalog.aroma_line"
PRICE_PER_GRAM = "catalog.price_per_gram_line"
BULK = "catalog.bulk_line"


class MissingCatalogKey(Exception):
    """A catalog key that gettext answers with the key itself. Names the key and nothing
    else, so no message id ever reaches a catalog line."""

    def __init__(self, key: str) -> None:
        super().__init__(f"No catalog text for key {key}")
        self.key = key


def _template(translations: Translations, key: str) -> str:
    template = str(translations.gettext(key))
    if template == key:
        raise MissingCatalogKey(key)
    return template


def _words(translations: Translations) -> CatalogWords:
    indica = _template(translations, INDICA)
    aroma = _template(translations, AROMA)
    price_per_gram = _template(translations, PRICE_PER_GRAM)
    bulk = _template(translations, BULK)
    return CatalogWords(
        nothing_to_offer=_template(translations, NOTHING_TO_OFFER),
        indica=lambda share, other: indica.format(indica=share, sativa=other),
        aroma=lambda text: aroma.format(aroma=text),
        price_per_gram=lambda price: price_per_gram.format(price=price),
        bulk=lambda grams, price: bulk.format(grams=grams, price=price),
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
