"""`ReasonDefaults` over the copy module's gettext catalogs (docs/adr/0050): the two
withdrawal reasons a new business is opened with, in its stored language, in order. A
language with no catalog gets English's. A later language change never renames them: they
are the business's own data once created."""

from __future__ import annotations

from app.shared.copy import CopyCatalog, required_text
from app.shared.language import Language
from app.stock.domain.withdrawal_reason import ReasonName

DEFAULT_REASON_KEYS = (
    "stock.default_reason.marketing",
    "stock.default_reason.own_use",
)


class BabelReasonDefaults:
    def __init__(self, copy_catalog: CopyCatalog) -> None:
        self._copy_catalog = copy_catalog

    def for_language(self, language: Language) -> tuple[ReasonName, ...]:
        translations = self._copy_catalog.translations_or_english(language)
        return tuple(
            ReasonName.of(required_text(translations, key)) for key in DEFAULT_REASON_KEYS
        )
