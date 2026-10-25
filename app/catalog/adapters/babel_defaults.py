"""`HeaderFooterDefaults` over the copy module's gettext catalogs (docs/adr/0050): the header
and footer a new business is opened with, in its stored language. Read at the opening, then
they are the business's own data; a language with no catalog gets English's.
"""

from __future__ import annotations

from app.catalog.domain.header_footer import CatalogHeaderFooter
from app.shared.copy import CopyCatalog, required_text
from app.shared.language import Language

DEFAULT_HEADER_KEY = "catalog.default_header"
DEFAULT_FOOTER_KEY = "catalog.default_footer"


class BabelHeaderFooterDefaults:
    def __init__(self, copy_catalog: CopyCatalog) -> None:
        self._copy_catalog = copy_catalog

    def for_language(self, language: Language) -> CatalogHeaderFooter:
        translations = self._copy_catalog.translations_or_english(language)
        return CatalogHeaderFooter.of(
            required_text(translations, DEFAULT_HEADER_KEY),
            required_text(translations, DEFAULT_FOOTER_KEY),
        )
