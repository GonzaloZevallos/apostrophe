"""What the spreadsheet import needs from payment methods, for one business: the id of the
method an imported payment names, found by name (ignoring case and spaces) or created last
with the generic icon. Nothing here commits: the import's own transaction does, once, at
the end of a real run (`app/spreadsheet_import/application/no_commit.py`)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.adapters.tables import PaymentMethodRow
from app.payment_methods.domain.method import PaymentMethodIcon, PaymentMethodName


class PaymentMethodsImport:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._methods = SqlPaymentMethods(session, business_id)

    def ensure_by_name(self, raw_name: str) -> int:
        name = PaymentMethodName.of(raw_name)
        statement = select(PaymentMethodRow.id).where(
            PaymentMethodRow.business_id == self._business_id,
            PaymentMethodRow.name_key == name.name_key,
        )
        existing = self._session.scalar(statement)
        if existing is not None:
            return existing
        added = self._methods.add(name, PaymentMethodIcon.DEFAULT)
        assert added.id is not None
        return added.id
