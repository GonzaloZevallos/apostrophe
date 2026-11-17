"""`MethodDefaults` over the copy module's gettext catalogs (docs/adr/0050): the two
payment methods a new business is opened with, in its stored language, in order. A
language with no catalog gets English's. A later language change never renames them: they
are the business's own data once created."""

from __future__ import annotations

from app.payment_methods.domain.method import PaymentMethodName
from app.shared.copy import CopyCatalog, required_text
from app.shared.language import Language

DEFAULT_METHOD_KEYS = (
    "payment_methods.default_method.cash",
    "payment_methods.default_method.transfer",
)


class BabelMethodDefaults:
    def __init__(self, copy_catalog: CopyCatalog) -> None:
        self._copy_catalog = copy_catalog

    def for_language(self, language: Language) -> tuple[PaymentMethodName, ...]:
        translations = self._copy_catalog.translations_or_english(language)
        return tuple(
            PaymentMethodName.of(required_text(translations, key)) for key in DEFAULT_METHOD_KEYS
        )
