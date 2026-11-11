"""What the spreadsheet import needs of the payment methods: who holds a default name,
and a way to add the method when nobody does. Never commits: the import's own
transaction covers it (docs/adr/0085)."""

from dataclasses import dataclass
from enum import Enum, auto

from sqlalchemy.orm import Session

from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.domain.method import DEFAULT_ICON, PaymentMethodName


class Holder(Enum):
    NONE = auto()
    ARCHIVED = auto()
    OFFERED = auto()


@dataclass(frozen=True)
class Holding:
    holder: Holder
    method_id: int | None = None


class PaymentMethodsForImport:
    def __init__(self, session: Session, business_id: int) -> None:
        self._methods = SqlPaymentMethods(session, business_id)

    def holder_of(self, default_name: str) -> Holding:
        """Who holds `default_name`: an offered method (its id), an archived one, or
        nobody."""
        found = self._methods.by_key(PaymentMethodName.of(default_name).name_key)
        if found is None:
            return Holding(Holder.NONE)
        if found.offered:
            return Holding(Holder.OFFERED, found.id)
        return Holding(Holder.ARCHIVED)

    def add(self, default_name: str) -> int:
        """Adds the method last, with the `other` icon."""
        return self._methods.add(PaymentMethodName.of(default_name), DEFAULT_ICON).id
