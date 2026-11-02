"""`PaymentMethodDefaults` over the copy module's gettext catalogs (docs/adr/0050): the two
methods a new business is opened with, in its stored language, "Cash" with the coins icon
and "Transfer" with the bank icon. A language with no catalog gets English's.
"""

from __future__ import annotations

from app.payment_methods.domain.method import PaymentMethodIcon, PaymentMethodName, PaymentMethodSeed
from app.shared.copy import CopyCatalog, required_text
from app.shared.language import Language

DEFAULT_METHODS = (
    ("payment_methods.default.cash", PaymentMethodIcon.COINS),
    ("payment_methods.default.transfer", PaymentMethodIcon.BANK),
)


class BabelPaymentMethodDefaults:
    def __init__(self, copy_catalog: CopyCatalog) -> None:
        self._copy_catalog = copy_catalog

    def for_language(self, language: Language) -> tuple[PaymentMethodSeed, ...]:
        translations = self._copy_catalog.translations_or_english(language)
        return tuple(
            PaymentMethodSeed(PaymentMethodName.of(required_text(translations, key)), icon)
            for key, icon in DEFAULT_METHODS
        )
