"""`CategoryDefaults` over the copy module's gettext catalogs (docs/adr/0050): the four
categories a new business is opened with, in its stored language, in today's order. A
language with no catalog gets English's.
"""

from __future__ import annotations

from app.expenses.domain.category import CategoryName
from app.shared.copy import CopyCatalog, required_text
from app.shared.language import Language

DEFAULT_CATEGORY_KEYS = (
    "expenses.default_category.growing_supplies",
    "expenses.default_category.packaging",
    "expenses.default_category.shipping_and_transport",
    "expenses.default_category.other",
)


class BabelCategoryDefaults:
    def __init__(self, copy_catalog: CopyCatalog) -> None:
        self._copy_catalog = copy_catalog

    def for_language(self, language: Language) -> tuple[CategoryName, ...]:
        translations = self._copy_catalog.translations_or_english(language)
        return tuple(
            CategoryName.of(required_text(translations, key)) for key in DEFAULT_CATEGORY_KEYS
        )
