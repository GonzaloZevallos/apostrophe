"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets
"Cash" and "Transfer" in its stored language, inside the same transaction that opens it.
Accounts never imports this module; `app/main.py` wires it in, through
`CompositeOpening`."""

from sqlalchemy.orm import Session

from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.application.manage_methods import open_default_methods
from app.payment_methods.application.ports import MethodDefaults
from app.payment_methods.domain.method import PaymentMethodIcon
from app.shared.language import BusinessLanguage

DEFAULT_ICONS = (PaymentMethodIcon.BANKNOTE, PaymentMethodIcon.BANK)


class PaymentMethodsOpening:
    def __init__(self, session: Session, defaults: MethodDefaults) -> None:
        self._session = session
        self._defaults = defaults

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        open_default_methods(
            SqlPaymentMethods(self._session, business_id),
            self._defaults.for_language(language.language),
            DEFAULT_ICONS,
        )
