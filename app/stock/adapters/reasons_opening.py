"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets the two
default withdrawal reasons in its stored language, inside the same transaction that opens
it. Accounts never imports this module; `app/main.py` wires it in, through
`CompositeOpening`."""

from sqlalchemy.orm import Session

from app.shared.language import BusinessLanguage
from app.stock.adapters.sql_withdrawal_reasons import SqlWithdrawalReasons
from app.stock.application.manage_reasons import open_default_reasons
from app.stock.application.ports import ReasonDefaults


class WithdrawalReasonsOpening:
    def __init__(self, session: Session, defaults: ReasonDefaults) -> None:
        self._session = session
        self._defaults = defaults

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        open_default_reasons(
            SqlWithdrawalReasons(self._session, business_id),
            self._defaults.for_language(language.language),
        )
